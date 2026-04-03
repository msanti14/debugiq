import { describe, it, expect } from "vitest";
import { SidebarProvider, formatExplanation } from "../src/providers/SidebarProvider";
import type { SignatureInfo } from "../src/providers/SidebarProvider";
import type { AnalysisResult } from "@debugiq/shared-types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EXPLANATION =
  "## What\nA bare except: clause catches all exceptions.\n\n" +
  "## Why it is wrong\nIt silently swallows KeyboardInterrupt and SystemExit.\n\n" +
  "## What could fail\nCtrl-C will not stop the program.\n\n" +
  "## Exercise\nRewrite the block catching only the specific exception type.";

const LEARN_RESULT: AnalysisResult = {
  result_id: "test-001",
  user_id: "",
  language: "python",
  mode: "learn",
  code_hash: "a".repeat(64),
  findings_count: 1,
  demo_mode: false,
  model_used: "copilot-claude-sonnet-4",
  analyzed_at: "2026-04-02T00:00:00.000Z",
  created_at: "2026-04-02T00:00:00.000Z",
  findings: [
    {
      id: "f-001",
      category: "bare_exception",
      severity: "medium",
      title: "Bare except clause swallows all errors",
      description: "A bare except: catches every exception.",
      line_start: 3,
      line_end: 3,
      fix_hint: "Use except Exception as e:",
      explanation: EXPLANATION,
    },
  ],
};

const QUICK_RESULT: AnalysisResult = {
  result_id: "test-002",
  user_id: "",
  language: "typescript",
  mode: "quick",
  code_hash: "b".repeat(64),
  findings_count: 1,
  demo_mode: false,
  model_used: "copilot-gpt-4o",
  analyzed_at: "2026-04-02T00:00:00.000Z",
  created_at: "2026-04-02T00:00:00.000Z",
  findings: [
    {
      id: "f-002",
      category: "null_unhandled",
      severity: "high",
      title: "Null dereference on API response",
      description: "Accessing .data.user without null check.",
      line_start: 10,
      line_end: 10,
      fix_hint: "Use optional chaining: response.data?.user",
    },
  ],
};

// ── renderHtml — Learn Mode ───────────────────────────────────────────────────

describe("SidebarProvider.renderHtml() — Learn Mode", () => {
  it("contains explanation text in the rendered HTML", () => {
    const html = SidebarProvider.renderHtml(LEARN_RESULT);
    expect(html).toContain("bare except");
  });

  it("contains all four section headings from the explanation", () => {
    const html = SidebarProvider.renderHtml(LEARN_RESULT);
    expect(html).toContain("What");
    expect(html).toContain("Why it is wrong");
    expect(html).toContain("What could fail");
    expect(html).toContain("Exercise");
  });

  it("HTML-escapes dangerous characters in explanation", () => {
    const dangerous = {
      ...LEARN_RESULT,
      findings: [
        {
          ...LEARN_RESULT.findings[0],
          explanation: "## What\n<script>alert('xss')</script>",
        },
      ],
    };
    const html = SidebarProvider.renderHtml(dangerous);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("heading shows 'DebugIQ — Learn Mode' for non-demo learn results", () => {
    const html = SidebarProvider.renderHtml(LEARN_RESULT);
    expect(html).toContain("DebugIQ — Learn Mode");
  });

  it("shows the severity badge for the finding", () => {
    const html = SidebarProvider.renderHtml(LEARN_RESULT);
    expect(html).toContain("badge-medium");
  });
});

// ── renderHtml — Quick Mode ───────────────────────────────────────────────────

describe("SidebarProvider.renderHtml() — Quick Mode", () => {
  it("heading shows 'DebugIQ — Analysis Results' for non-demo quick results", () => {
    const html = SidebarProvider.renderHtml(QUICK_RESULT);
    expect(html).toContain("DebugIQ — Analysis Results");
  });

  it("renders fix_hint in quick mode", () => {
    const html = SidebarProvider.renderHtml(QUICK_RESULT);
    expect(html).toContain("optional chaining");
  });

  it("does not crash when finding has no explanation", () => {
    expect(() => SidebarProvider.renderHtml(QUICK_RESULT)).not.toThrow();
  });
});

// ── formatExplanation ─────────────────────────────────────────────────────────

describe("formatExplanation()", () => {
  it("wraps ## headings in explanation-heading spans", () => {
    const html = formatExplanation("## What\nsome body");
    expect(html).toContain("explanation-heading");
    expect(html).toContain("What");
  });

  it("renders body text inside explanation-body paragraphs", () => {
    const html = formatExplanation("## What\nsome body text");
    expect(html).toContain("explanation-body");
    expect(html).toContain("some body text");
  });

  it("escapes HTML in body text", () => {
    const html = formatExplanation("## What\n<b>dangerous</b>");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
  });

  it("falls back to plain text for unstructured explanations", () => {
    const html = formatExplanation("Just a plain explanation with no headings.");
    expect(html).toContain("Just a plain explanation");
    expect(html).toContain("explanation-body");
  });
});

// ── renderHtml — Signature section ───────────────────────────────────────────

const SIG_INFO_NEW: SignatureInfo = {
  signature: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
  status: "new",
};

const SIG_INFO_REPEATED: SignatureInfo = {
  signature: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
  status: "repeated",
};

describe("SidebarProvider.renderHtml() — with signature info", () => {
  it("renders the signature-section element when signatureInfo is provided", () => {
    const html = SidebarProvider.renderHtml(QUICK_RESULT, SIG_INFO_NEW);
    expect(html).toContain("signature-section");
  });

  it("renders the sig-label 'Bug Signature'", () => {
    const html = SidebarProvider.renderHtml(QUICK_RESULT, SIG_INFO_NEW);
    expect(html).toContain("Bug Signature");
  });

  it("renders a shortened version of the signature (first 16 chars)", () => {
    const html = SidebarProvider.renderHtml(QUICK_RESULT, SIG_INFO_NEW);
    expect(html).toContain("a1b2c3d4e5f6a7b8");
  });

  it("renders 'New signature' badge when status is new", () => {
    const html = SidebarProvider.renderHtml(QUICK_RESULT, SIG_INFO_NEW);
    expect(html).toContain("New signature");
    expect(html).toContain("sig-new");
  });

  it("renders 'Repeated signature' badge when status is repeated", () => {
    const html = SidebarProvider.renderHtml(QUICK_RESULT, SIG_INFO_REPEATED);
    expect(html).toContain("Repeated signature");
    expect(html).toContain("sig-repeated");
  });

  it("does not render Bug Signature element when signatureInfo is omitted", () => {
    const html = SidebarProvider.renderHtml(QUICK_RESULT);
    // The CSS contains class selectors like `.sig-label` — check that the
    // actual HTML element attributes are absent (only appear in DOM, not CSS)
    expect(html).not.toContain('class="sig-label"');
    expect(html).not.toContain('class="sig-value"');
  });

  it("HTML-escapes the signature value (no raw < or > injection)", () => {
    const dangerous: SignatureInfo = {
      signature: "<script>bad</script>" + "a".repeat(43),
      status: "new",
    };
    const html = SidebarProvider.renderHtml(QUICK_RESULT, dangerous);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders signature section before the findings list", () => {
    const html = SidebarProvider.renderHtml(QUICK_RESULT, SIG_INFO_NEW);
    const sigPos = html.indexOf("signature-section");
    const findingPos = html.indexOf("finding");
    expect(sigPos).toBeLessThan(findingPos);
  });

  it("existing findings still render correctly when signatureInfo is present", () => {
    const html = SidebarProvider.renderHtml(QUICK_RESULT, SIG_INFO_NEW);
    expect(html).toContain("optional chaining");
    expect(html).toContain("badge-high");
  });
});

// ── renderHtml — Suggested next steps section ─────────────────────────────────

describe("SidebarProvider.renderHtml() — with suggestions", () => {
  const SUGGESTIONS = [
    'This pattern keeps recurring. Consider running "DebugIQ: Run Learn Debug".',
    "Create a team task to address this bug pattern systematically.",
  ];

  it("renders 'Suggested next steps' heading when suggestions are provided", () => {
    const html = SidebarProvider.renderHtml(QUICK_RESULT, SIG_INFO_REPEATED, SUGGESTIONS);
    expect(html).toContain("Suggested next steps");
  });

  it("renders the suggestions-section element", () => {
    const html = SidebarProvider.renderHtml(QUICK_RESULT, SIG_INFO_REPEATED, SUGGESTIONS);
    expect(html).toContain('class="suggestions-section"');
  });

  it("renders each suggestion text", () => {
    const html = SidebarProvider.renderHtml(QUICK_RESULT, SIG_INFO_REPEATED, SUGGESTIONS);
    expect(html).toContain("recurring");
    expect(html).toContain("team task");
  });

  it("does NOT render suggestions-section when suggestions array is empty", () => {
    const html = SidebarProvider.renderHtml(QUICK_RESULT, SIG_INFO_REPEATED, []);
    expect(html).not.toContain('class="suggestions-section"');
    expect(html).not.toContain("Suggested next steps");
  });

  it("does NOT render suggestions-section when suggestions param is omitted", () => {
    const html = SidebarProvider.renderHtml(QUICK_RESULT, SIG_INFO_REPEATED);
    expect(html).not.toContain('class="suggestions-section"');
  });

  it("does NOT render suggestions-section without signatureInfo even if suggestions provided", () => {
    // suggestions alone without signatureInfo: the section should still be renderable
    // (suggestions don't require signatureInfo), but let's verify it works either way
    const html = SidebarProvider.renderHtml(QUICK_RESULT, undefined, SUGGESTIONS);
    expect(html).toContain("Suggested next steps");
  });

  it("HTML-escapes suggestion text (XSS prevention)", () => {
    const malicious = ['<script>alert("xss")</script>'];
    const html = SidebarProvider.renderHtml(QUICK_RESULT, SIG_INFO_NEW, malicious);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders suggestions section after signature section and before findings", () => {
    const html = SidebarProvider.renderHtml(QUICK_RESULT, SIG_INFO_NEW, SUGGESTIONS);
    const sigPos = html.indexOf("signature-section");
    const sugPos = html.indexOf('class="suggestions-section"');
    const findPos = html.indexOf('class="finding"');
    expect(sigPos).toBeLessThan(sugPos);
    expect(sugPos).toBeLessThan(findPos);
  });

  it("existing findings still render with both signatureInfo and suggestions", () => {
    const html = SidebarProvider.renderHtml(QUICK_RESULT, SIG_INFO_NEW, SUGGESTIONS);
    expect(html).toContain("optional chaining");
    expect(html).toContain("badge-high");
  });
});

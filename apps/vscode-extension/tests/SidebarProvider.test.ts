import { describe, it, expect } from "vitest";
import { SidebarProvider, formatExplanation } from "../src/providers/SidebarProvider";
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

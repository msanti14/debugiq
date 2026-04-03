import { describe, it, expect } from "vitest";
import {
  buildHookScript,
  HOOK_START_MARKER,
  HOOK_END_MARKER,
} from "../src/signatures/HookInstaller";

// ── buildHookScript — new file ────────────────────────────────────────────────

describe("buildHookScript() — new file (existingContent === null)", () => {
  it("starts with a #!/bin/sh shebang", () => {
    const script = buildHookScript(null);
    expect(script.startsWith("#!/bin/sh")).toBe(true);
  });

  it("contains the DebugIQ start marker", () => {
    const script = buildHookScript(null);
    expect(script).toContain(HOOK_START_MARKER);
  });

  it("contains the DebugIQ end marker", () => {
    const script = buildHookScript(null);
    expect(script).toContain(HOOK_END_MARKER);
  });

  it("start marker appears before end marker", () => {
    const script = buildHookScript(null);
    const startIdx = script.indexOf(HOOK_START_MARKER);
    const endIdx = script.indexOf(HOOK_END_MARKER);
    expect(startIdx).toBeLessThan(endIdx);
  });

  it("contains the warn-only guarantee (|| true)", () => {
    const script = buildHookScript(null);
    expect(script).toContain("|| true");
  });

  it("does NOT contain any 'exit 1' that could block a commit", () => {
    const script = buildHookScript(null);
    expect(script).not.toContain("exit 1");
  });

  it("references the debugiq-sig-status.txt file", () => {
    const script = buildHookScript(null);
    expect(script).toContain("debugiq-sig-status.txt");
  });
});

// ── buildHookScript — appending to existing hook ──────────────────────────────

describe("buildHookScript() — existing hook without DebugIQ markers", () => {
  const EXISTING = "#!/bin/sh\nnpm test\n";

  it("preserves the existing hook content", () => {
    const script = buildHookScript(EXISTING);
    expect(script).toContain("npm test");
  });

  it("appends DebugIQ start marker after existing content", () => {
    const script = buildHookScript(EXISTING);
    const existingEnd = script.indexOf("npm test") + "npm test".length;
    const markerPos = script.indexOf(HOOK_START_MARKER);
    expect(markerPos).toBeGreaterThan(existingEnd);
  });

  it("still contains end marker", () => {
    const script = buildHookScript(EXISTING);
    expect(script).toContain(HOOK_END_MARKER);
  });

  it("still contains the warn-only guarantee", () => {
    const script = buildHookScript(EXISTING);
    expect(script).toContain("|| true");
  });

  it("does NOT contain any 'exit 1'", () => {
    const script = buildHookScript(EXISTING);
    expect(script).not.toContain("exit 1");
  });

  it("existing hook without trailing newline still gets DebugIQ appended", () => {
    const noNewline = "#!/bin/sh\nsome-command";
    const script = buildHookScript(noNewline);
    expect(script).toContain(HOOK_START_MARKER);
  });
});

// ── buildHookScript — patching existing DebugIQ section ──────────────────────

describe("buildHookScript() — existing hook already has DebugIQ markers", () => {
  const OLD_SECTION = `${HOOK_START_MARKER}\n# Old DebugIQ content\n${HOOK_END_MARKER}`;
  const WITH_MARKERS = `#!/bin/sh\nsome-other-hook\n\n${OLD_SECTION}\n`;

  it("does not duplicate the start marker", () => {
    const script = buildHookScript(WITH_MARKERS);
    const count = (script.match(new RegExp(HOOK_START_MARKER.replace(/-/g, "\\-"), "g")) ?? []).length;
    expect(count).toBe(1);
  });

  it("does not duplicate the end marker", () => {
    const script = buildHookScript(WITH_MARKERS);
    const count = (script.match(new RegExp(HOOK_END_MARKER.replace(/-/g, "\\-"), "g")) ?? []).length;
    expect(count).toBe(1);
  });

  it("preserves content that was before the markers", () => {
    const script = buildHookScript(WITH_MARKERS);
    expect(script).toContain("some-other-hook");
  });

  it("replaces old DebugIQ content with current version", () => {
    const script = buildHookScript(WITH_MARKERS);
    expect(script).not.toContain("Old DebugIQ content");
    expect(script).toContain("debugiq-sig-status.txt");
  });
});

// ── Warn-only semantics ───────────────────────────────────────────────────────

describe("buildHookScript() — warn-only semantics", () => {
  it("all script outputs are to stderr (>&2) or suppressed — never forces failure", () => {
    const script = buildHookScript(null);
    // Any printf/echo should redirect to stderr, not stdout
    // The key invariant is no unconditional exit 1
    expect(script).not.toMatch(/^\s*exit\s+1\b/m);
  });

  it("hook body is wrapped in a subshell with || true so any failure is swallowed", () => {
    const script = buildHookScript(null);
    // The pattern `(...) || true` ensures the outer hook exits 0 even if
    // the inner subshell fails
    expect(script).toMatch(/\(\s*[\s\S]*?\)\s*\|\|\s*true/);
  });
});

// ── warnOn / repeated-signature semantics ────────────────────────────────────

describe("buildHookScript() — warn_on and repeated-signature semantics", () => {
  it("reads warn_on field from the status file", () => {
    const script = buildHookScript(null);
    expect(script).toContain("warn_on=");
  });

  it("contains an elif branch for repeated signature warnings", () => {
    const script = buildHookScript(null);
    expect(script).toContain("elif");
    expect(script).toContain('"repeated"');
  });

  it("repeated branch is gated on the new-or-critical warn_on value", () => {
    const script = buildHookScript(null);
    expect(script).toContain('"new-or-critical"');
  });

  it("repeated branch is gated on critical or high severity", () => {
    const script = buildHookScript(null);
    // Locate elif block and verify it checks severity
    const elifIdx = script.indexOf("elif");
    expect(elifIdx).toBeGreaterThan(-1);
    const afterElif = script.slice(elifIdx);
    expect(afterElif).toContain('"critical"');
    expect(afterElif).toContain('"high"');
  });

  it("new-signature branch warns when status=new", () => {
    const script = buildHookScript(null);
    expect(script).toContain('"new"');
    expect(script).toContain("new bug signature detected");
  });

  it("repeated warning message is distinct from new-signature warning message", () => {
    const script = buildHookScript(null);
    expect(script).toContain("repeated high-severity bug signature");
  });

  it("does NOT block commits in the repeated branch either (no exit 1)", () => {
    const script = buildHookScript(null);
    expect(script).not.toContain("exit 1");
  });

  it("repeated branch does not fire unconditionally — only inside new-or-critical guard", () => {
    const script = buildHookScript(null);
    // The repeated warning text must be inside the elif + severity check,
    // not at the top level of the if block
    const newIdx = script.indexOf("new bug signature detected");
    const repeatedIdx = script.indexOf("repeated high-severity bug signature");
    // Both messages must exist
    expect(newIdx).toBeGreaterThan(-1);
    expect(repeatedIdx).toBeGreaterThan(-1);
    // The repeated message must come after the elif marker
    expect(repeatedIdx).toBeGreaterThan(script.indexOf("elif"));
  });
});

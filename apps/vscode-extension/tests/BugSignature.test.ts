import { describe, it, expect } from "vitest";
import {
  normalizeFindingsForSignature,
  computeBugSignature,
} from "../src/analyzer/BugSignature";
import type { Finding } from "@debugiq/shared-types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "f-001",
    category: "sql_injection",
    severity: "critical",
    title: "SQL Injection",
    description: "Unparameterized query",
    line_start: 5,
    line_end: 5,
    fix_hint: "Use parameterized queries",
    ...overrides,
  };
}

const FINDING_A = makeFinding({
  id: "f-001",
  category: "sql_injection",
  severity: "critical",
  line_start: 5,
  line_end: 5,
  title: "Title A",
  description: "Desc A",
  fix_hint: "Fix A",
});

const FINDING_B = makeFinding({
  id: "f-002",
  category: "null_unhandled",
  severity: "high",
  line_start: 12,
  line_end: 14,
  title: "Title B",
  description: "Desc B",
  fix_hint: "Fix B",
});

// ── normalizeFindingsForSignature ─────────────────────────────────────────────

describe("normalizeFindingsForSignature()", () => {
  it("includes language in normalized output", () => {
    const result = normalizeFindingsForSignature([FINDING_A], "python", "quick");
    expect(result.language).toBe("python");
  });

  it("includes mode in normalized output", () => {
    const result = normalizeFindingsForSignature([FINDING_A], "python", "learn");
    expect(result.mode).toBe("learn");
  });

  it("normalized finding contains category, severity, line_start, line_end", () => {
    const result = normalizeFindingsForSignature([FINDING_A], "python", "quick");
    const f = result.findings[0];
    expect(f.category).toBe("sql_injection");
    expect(f.severity).toBe("critical");
    expect(f.line_start).toBe(5);
    expect(f.line_end).toBe(5);
  });

  it("normalized finding does NOT include title, description, fix_hint, explanation", () => {
    const result = normalizeFindingsForSignature([FINDING_A], "python", "quick");
    const f = result.findings[0] as Record<string, unknown>;
    expect(f["title"]).toBeUndefined();
    expect(f["description"]).toBeUndefined();
    expect(f["fix_hint"]).toBeUndefined();
    expect(f["explanation"]).toBeUndefined();
    expect(f["id"]).toBeUndefined();
  });

  it("sorts findings deterministically by category then severity then line_start", () => {
    // B (null_unhandled) should sort before A (sql_injection) alphabetically
    const result = normalizeFindingsForSignature([FINDING_A, FINDING_B], "python", "quick");
    expect(result.findings[0].category).toBe("null_unhandled");
    expect(result.findings[1].category).toBe("sql_injection");
  });

  it("produces the same order regardless of input order (order-invariant)", () => {
    const fwd = normalizeFindingsForSignature([FINDING_A, FINDING_B], "python", "quick");
    const rev = normalizeFindingsForSignature([FINDING_B, FINDING_A], "python", "quick");
    expect(fwd.findings).toEqual(rev.findings);
  });

  it("handles empty findings array", () => {
    const result = normalizeFindingsForSignature([], "typescript", "quick");
    expect(result.findings).toHaveLength(0);
    expect(result.language).toBe("typescript");
  });
});

// ── computeBugSignature ───────────────────────────────────────────────────────

describe("computeBugSignature()", () => {
  it("returns a 64-character hex string", () => {
    const input = normalizeFindingsForSignature([FINDING_A], "python", "quick");
    expect(computeBugSignature(input)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic — same input always returns same hash", () => {
    const input = normalizeFindingsForSignature([FINDING_A], "python", "quick");
    expect(computeBugSignature(input)).toBe(computeBugSignature(input));
  });

  it("produces different hashes for different findings", () => {
    const inputA = normalizeFindingsForSignature([FINDING_A], "python", "quick");
    const inputB = normalizeFindingsForSignature([FINDING_B], "python", "quick");
    expect(computeBugSignature(inputA)).not.toBe(computeBugSignature(inputB));
  });

  it("produces different hashes for different languages", () => {
    const inputPy = normalizeFindingsForSignature([FINDING_A], "python", "quick");
    const inputTs = normalizeFindingsForSignature([FINDING_A], "typescript", "quick");
    expect(computeBugSignature(inputPy)).not.toBe(computeBugSignature(inputTs));
  });

  it("produces different hashes for different modes", () => {
    const inputQuick = normalizeFindingsForSignature([FINDING_A], "python", "quick");
    const inputLearn = normalizeFindingsForSignature([FINDING_A], "python", "learn");
    expect(computeBugSignature(inputQuick)).not.toBe(computeBugSignature(inputLearn));
  });

  it("produces the same hash regardless of finding input order", () => {
    const input1 = normalizeFindingsForSignature([FINDING_A, FINDING_B], "python", "quick");
    const input2 = normalizeFindingsForSignature([FINDING_B, FINDING_A], "python", "quick");
    expect(computeBugSignature(input1)).toBe(computeBugSignature(input2));
  });

  it("ignores title, description, fix_hint changes — same structural findings produce same hash", () => {
    const f1 = makeFinding({ category: "xss", severity: "high", line_start: 7, line_end: 7, title: "Title v1" });
    const f2 = makeFinding({ category: "xss", severity: "high", line_start: 7, line_end: 7, title: "Title v2 (changed)" });
    const input1 = normalizeFindingsForSignature([f1], "python", "quick");
    const input2 = normalizeFindingsForSignature([f2], "python", "quick");
    expect(computeBugSignature(input1)).toBe(computeBugSignature(input2));
  });

  it("ignores explanation text changes", () => {
    const f1 = makeFinding({ category: "bare_exception", severity: "medium", line_start: 3, line_end: 3, explanation: "Explanation v1" });
    const f2 = makeFinding({ category: "bare_exception", severity: "medium", line_start: 3, line_end: 3, explanation: "Explanation v2" });
    const input1 = normalizeFindingsForSignature([f1], "python", "learn");
    const input2 = normalizeFindingsForSignature([f2], "python", "learn");
    expect(computeBugSignature(input1)).toBe(computeBugSignature(input2));
  });

  it("produces a valid hash for empty findings", () => {
    const input = normalizeFindingsForSignature([], "python", "quick");
    const sig = computeBugSignature(input);
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });
});

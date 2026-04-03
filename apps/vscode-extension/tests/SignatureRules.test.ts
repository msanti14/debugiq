import { describe, it, expect } from "vitest";
import {
  evaluateSignatureRules,
  highestSeverity,
  type RulesInput,
} from "../src/signatures/SignatureRules";

// ── highestSeverity ───────────────────────────────────────────────────────────

describe("highestSeverity()", () => {
  it("returns undefined for an empty array", () => {
    expect(highestSeverity([])).toBeUndefined();
  });

  it("returns the single element for a one-item array", () => {
    expect(highestSeverity(["medium"])).toBe("medium");
  });

  it("returns 'critical' when critical is present alongside others", () => {
    expect(highestSeverity(["low", "critical", "high"])).toBe("critical");
  });

  it("returns 'high' when high is the worst", () => {
    expect(highestSeverity(["medium", "low", "high", "info"])).toBe("high");
  });

  it("returns 'info' when all findings are info", () => {
    expect(highestSeverity(["info", "info"])).toBe("info");
  });

  it("handles a single 'critical' input", () => {
    expect(highestSeverity(["critical"])).toBe("critical");
  });
});

// ── evaluateSignatureRules — no suggestions ───────────────────────────────────

describe("evaluateSignatureRules() — zero suggestions", () => {
  it("returns empty array for new + low + balanced", () => {
    const input: RulesInput = {
      status: "new",
      mode: "quick",
      highestSeverity: "low",
      sensitivity: "balanced",
    };
    expect(evaluateSignatureRules(input)).toEqual([]);
  });

  it("returns empty array for new + info + balanced", () => {
    const input: RulesInput = {
      status: "new",
      mode: "learn",
      highestSeverity: "info",
      sensitivity: "balanced",
    };
    expect(evaluateSignatureRules(input)).toEqual([]);
  });

  it("returns empty array for new + medium + balanced", () => {
    const input: RulesInput = {
      status: "new",
      mode: "learn",
      highestSeverity: "medium",
      sensitivity: "balanced",
    };
    expect(evaluateSignatureRules(input)).toEqual([]);
  });
});

// ── Rule 1: repeated + high/critical → suggest Learn Mode ────────────────────

describe("evaluateSignatureRules() — Rule 1 (repeated + high/critical)", () => {
  it("fires for repeated + critical + balanced", () => {
    const input: RulesInput = {
      status: "repeated",
      mode: "quick",
      highestSeverity: "critical",
      sensitivity: "balanced",
    };
    const suggestions = evaluateSignatureRules(input);
    expect(suggestions.some((s) => s.toLowerCase().includes("learn"))).toBe(true);
  });

  it("fires for repeated + high + balanced", () => {
    const input: RulesInput = {
      status: "repeated",
      mode: "learn",
      highestSeverity: "high",
      sensitivity: "balanced",
    };
    const suggestions = evaluateSignatureRules(input);
    expect(suggestions.some((s) => s.toLowerCase().includes("learn"))).toBe(true);
  });

  it("does NOT fire for repeated + medium + balanced", () => {
    const input: RulesInput = {
      status: "repeated",
      mode: "quick",
      highestSeverity: "medium",
      sensitivity: "balanced",
    };
    const suggestions = evaluateSignatureRules(input);
    // Rule 1 should not fire — may still have Rule 4 suggestion
    const learnModeDeepSuggestions = suggestions.filter((s) =>
      s.includes("recurring at high severity"),
    );
    expect(learnModeDeepSuggestions).toHaveLength(0);
  });
});

// ── Rule 2: repeated + strict → suggest team task ────────────────────────────

describe("evaluateSignatureRules() — Rule 2 (repeated + strict)", () => {
  it("fires for repeated + strict, any severity", () => {
    const input: RulesInput = {
      status: "repeated",
      mode: "quick",
      highestSeverity: "medium",
      sensitivity: "strict",
    };
    const suggestions = evaluateSignatureRules(input);
    expect(suggestions.some((s) => s.toLowerCase().includes("team task"))).toBe(true);
  });

  it("does NOT fire for repeated + balanced", () => {
    const input: RulesInput = {
      status: "repeated",
      mode: "quick",
      highestSeverity: "medium",
      sensitivity: "balanced",
    };
    const suggestions = evaluateSignatureRules(input);
    expect(suggestions.some((s) => s.toLowerCase().includes("team task"))).toBe(false);
  });
});

// ── Rule 3: new + critical → suggest sharing with team ───────────────────────

describe("evaluateSignatureRules() — Rule 3 (new + critical)", () => {
  it("fires for new + critical + balanced", () => {
    const input: RulesInput = {
      status: "new",
      mode: "quick",
      highestSeverity: "critical",
      sensitivity: "balanced",
    };
    const suggestions = evaluateSignatureRules(input);
    expect(suggestions.some((s) => s.toLowerCase().includes("team"))).toBe(true);
  });

  it("fires for new + critical + strict", () => {
    const input: RulesInput = {
      status: "new",
      mode: "quick",
      highestSeverity: "critical",
      sensitivity: "strict",
    };
    const suggestions = evaluateSignatureRules(input);
    expect(suggestions.some((s) => s.toLowerCase().includes("team"))).toBe(true);
  });

  it("does NOT fire for new + high (not critical)", () => {
    const input: RulesInput = {
      status: "new",
      mode: "quick",
      highestSeverity: "high",
      sensitivity: "balanced",
    };
    const suggestions = evaluateSignatureRules(input);
    // Rule 3 specifically: "share with team" / "before merging" — not fired for non-critical
    expect(suggestions.some((s) => s.includes("before merging"))).toBe(false);
  });
});

// ── Rule 4: quick + repeated → suggest Learn Mode ────────────────────────────

describe("evaluateSignatureRules() — Rule 4 (quick + repeated)", () => {
  it("fires for quick + repeated + any severity", () => {
    const input: RulesInput = {
      status: "repeated",
      mode: "quick",
      highestSeverity: "low",
      sensitivity: "balanced",
    };
    const suggestions = evaluateSignatureRules(input);
    expect(suggestions.some((s) => s.toLowerCase().includes("learn"))).toBe(true);
  });

  it("does NOT fire for learn + repeated", () => {
    const input: RulesInput = {
      status: "repeated",
      mode: "learn",
      highestSeverity: "low",
      sensitivity: "balanced",
    };
    const suggestions = evaluateSignatureRules(input);
    // Rule 4 specifically: "Try DebugIQ: Run Learn Debug" — only for quick mode
    expect(suggestions.some((s) => s.includes("seen before"))).toBe(false);
  });
});

// ── Multiple rules firing ─────────────────────────────────────────────────────

describe("evaluateSignatureRules() — multiple rules", () => {
  it("can return multiple suggestions when several rules match", () => {
    // repeated + critical + strict + quick → Rules 1, 2, and 4 all fire
    const input: RulesInput = {
      status: "repeated",
      mode: "quick",
      highestSeverity: "critical",
      sensitivity: "strict",
    };
    const suggestions = evaluateSignatureRules(input);
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
  });

  it("returns a plain string array (no HTML)", () => {
    const input: RulesInput = {
      status: "new",
      mode: "quick",
      highestSeverity: "critical",
      sensitivity: "strict",
    };
    const suggestions = evaluateSignatureRules(input);
    for (const s of suggestions) {
      expect(s).not.toContain("<");
      expect(s).not.toContain(">");
    }
  });
});

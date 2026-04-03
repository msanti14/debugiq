/**
 * SignatureRules — pure rule engine for signature-based team insights.
 *
 * `evaluateSignatureRules` is a pure function: given a `RulesInput` it returns
 * a list of human-readable suggestion strings. Empty array = no suggestions.
 *
 * Rules are evaluated in priority order; multiple rules can fire for a single
 * input. All strings are plain text — callers must HTML-escape before rendering.
 */

import type { AnalysisMode } from "@debugiq/shared-types";

// ── Severity ordering ─────────────────────────────────────────────────────────

export type SeverityLevel = "critical" | "high" | "medium" | "low" | "info";

const SEVERITY_ORDER: Record<SeverityLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

/**
 * Returns the highest severity from a list of severity strings.
 * Returns `undefined` if the array is empty.
 */
export function highestSeverity(
  severities: string[],
): SeverityLevel | undefined {
  if (severities.length === 0) return undefined;
  return severities.reduce<SeverityLevel>((best, s) => {
    const candidate = s as SeverityLevel;
    return (SEVERITY_ORDER[candidate] ?? 99) < (SEVERITY_ORDER[best] ?? 99)
      ? candidate
      : best;
  }, severities[0] as SeverityLevel);
}

// ── RulesInput ────────────────────────────────────────────────────────────────

export interface RulesInput {
  /** "new" if this is the first time the signature appears in this repo */
  status: "new" | "repeated";
  /** Analysis mode that produced the result */
  mode: AnalysisMode;
  /** Highest severity across all findings in the result */
  highestSeverity: SeverityLevel | undefined;
  /** Sensitivity setting from VS Code configuration */
  sensitivity: "strict" | "balanced";
}

// ── evaluateSignatureRules ────────────────────────────────────────────────────

/**
 * Pure function — evaluates all rules against `input` and returns
 * an array of suggestion strings (may be empty).
 */
export function evaluateSignatureRules(input: RulesInput): string[] {
  const suggestions: string[] = [];
  const { status, mode, highestSeverity: sev, sensitivity } = input;

  const isHighOrCritical =
    sev === "critical" || sev === "high";
  const isCritical = sev === "critical";

  // Rule 1: repeated + high/critical → suggest Learn Mode
  if (status === "repeated" && isHighOrCritical) {
    suggestions.push(
      'This pattern keeps recurring at high severity. Consider running "DebugIQ: Run Learn Debug" to deeply understand the root cause.',
    );
  }

  // Rule 2: repeated + strict sensitivity → suggest creating a team task
  if (status === "repeated" && sensitivity === "strict") {
    suggestions.push(
      "Repeated signature detected. Consider creating a team task to address this bug pattern systematically.",
    );
  }

  // Rule 3: new + critical → suggest sharing with team
  if (status === "new" && isCritical) {
    suggestions.push(
      "New critical-severity signature found. Share this finding with your team before merging.",
    );
  }

  // Rule 4: quick mode + repeated → suggest Learn Mode for deeper analysis
  if (mode === "quick" && status === "repeated") {
    suggestions.push(
      'This signature was seen before. Try "DebugIQ: Run Learn Debug" for a detailed explanation and exercise.',
    );
  }

  return suggestions;
}

import { createHash } from "crypto";
import type { Finding, AnalysisMode, SupportedLanguage } from "@debugiq/shared-types";

/**
 * BugSignature — deterministic SHA-256 signature for an analysis result.
 *
 * Only stable, structural fields are included in the signature:
 *   language, mode, and for each finding: category, severity, line_start, line_end.
 *
 * Title, description, fix_hint, and explanation are intentionally excluded
 * because they are LLM-generated text that may vary between runs even for the
 * same underlying bug pattern.
 *
 * All pure functions — no vscode dependency, fully testable in Node.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NormalizedFinding {
  category: string;
  severity: string;
  line_start: number;
  line_end: number;
}

export interface NormalizedSignatureInput {
  language: SupportedLanguage;
  mode: AnalysisMode;
  findings: NormalizedFinding[];
}

// ── normalizeFindingsForSignature ─────────────────────────────────────────────

/**
 * Produces a deterministic, order-invariant structure from findings for
 * signature hashing. Findings are sorted by (category, severity, line_start,
 * line_end) so that the same logical set of findings always yields the same
 * signature regardless of iteration order.
 */
export function normalizeFindingsForSignature(
  findings: Finding[],
  language: SupportedLanguage,
  mode: AnalysisMode,
): NormalizedSignatureInput {
  const normalized: NormalizedFinding[] = findings
    .map((f) => ({
      category: f.category,
      severity: f.severity,
      line_start: f.line_start,
      line_end: f.line_end,
    }))
    .sort((a, b) => {
      if (a.category !== b.category) return a.category < b.category ? -1 : 1;
      if (a.severity !== b.severity) return a.severity < b.severity ? -1 : 1;
      if (a.line_start !== b.line_start) return a.line_start - b.line_start;
      return a.line_end - b.line_end;
    });

  return { language, mode, findings: normalized };
}

// ── computeBugSignature ───────────────────────────────────────────────────────

/**
 * Returns the SHA-256 hex digest of the canonical JSON representation of the
 * normalized signature input. The same input always produces the same hash.
 */
export function computeBugSignature(input: NormalizedSignatureInput): string {
  const canonical = JSON.stringify(input);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

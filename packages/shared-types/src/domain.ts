// ── Domain Types ─────────────────────────────────────────────────────────────
// SYNC RULE (ADR-001): Any change here requires a matching update to the
// corresponding Pydantic model in apps/api/src/results/router.py
// in the same commit. See docs/decisions/001-llm-in-extension.md.

export type BugCategory =
  | "sql_injection"
  | "null_unhandled"
  | "hardcoded_secret"
  | "bare_exception"
  | "client_side_auth"
  | "cors_misconfigured"
  | "xss"
  | "other";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type AnalysisMode = "quick" | "learn";

export type SupportedLanguage = "python" | "typescript";

export interface Finding {
  id: string;
  category: BugCategory;
  severity: Severity;
  title: string;          // max 80 chars
  description: string;    // max 500 chars
  line_start: number;
  line_end: number;
  fix_hint?: string;      // Quick mode: one-liner fix
  explanation?: string;   // Learn mode: educational explanation
}

export interface AnalysisResult {
  result_id: string;
  user_id: string;
  language: SupportedLanguage;
  mode: AnalysisMode;
  code_hash: string;      // SHA-256 hex — raw code is NEVER stored
  findings_count: number;
  findings: Finding[];
  model_used: string;
  duration_ms?: number;
  demo_mode: boolean;
  analyzed_at: string;    // ISO 8601
  created_at: string;     // ISO 8601
}

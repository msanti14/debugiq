// ── Auth API Shapes ───────────────────────────────────────────────────────────

export interface RegisterRequest {
  email: string;
  password: string;
  display_name?: string;
}

export interface RegisterResponse {
  user_id: string;
  email: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface LogoutRequest {
  refresh_token: string;
}

// ── User API Shapes ───────────────────────────────────────────────────────────

export interface UserResponse {
  user_id: string;
  email: string;
  display_name: string | null;
  tier: "free" | "starter" | "team" | "studio";
  created_at: string;
}

export interface PatchUserRequest {
  display_name?: string;
}

// ── Results API Shapes ────────────────────────────────────────────────────────

import type { Finding, AnalysisMode, SupportedLanguage } from "./domain";

export interface SaveResultRequest {
  language: SupportedLanguage;
  mode: AnalysisMode;
  code_hash: string;
  findings: Finding[];
  model_used: string;
  duration_ms?: number;
  demo_mode: boolean;
  analyzed_at: string;  // ISO 8601
  team_id?: string;
}

export interface SaveResultResponse {
  result_id: string;
  created_at: string;
}

export interface PaginatedResults<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// ── Health ────────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: "ok" | "degraded";
  db: "connected" | "error";
  version: string;
}

// ── Analytics API Shapes ──────────────────────────────────────────────────────

export type AnalyticsEventType =
  | "signature_generated"
  | "signature_repeated"
  | "hook_warning_shown"
  | "hook_installed";

export interface PostAnalyticsEventRequest {
  event_type: AnalyticsEventType;
  /** Structured metadata — never raw code, only hashes and enums. */
  properties: {
    signature_hash?: string;
    status?: "new" | "repeated";
    severity_summary?: "critical" | "high" | "medium" | "low" | "info" | "none";
    mode?: AnalysisMode;
    language?: SupportedLanguage;
    repo_key_hash?: string;
  };
}

export interface PostAnalyticsEventResponse {
  event_id: string;
}

// ── Teams API Shapes ──────────────────────────────────────────────────────────

export interface TeamResponse {
  team_id: string;
  name: string;
  owner_id: string;
  tier: string;
  created_at: string;
}

export interface CreateTeamRequest {
  name: string;
}

export interface TeamMemberResponse {
  user_id: string;
  email: string;
  role: string;
}

export interface AddMemberRequest {
  email: string;
  role: "admin" | "member";
}

// ── Team Analytics API Shapes ─────────────────────────────────────────────────

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface ModeCounts {
  quick: number;
  learn: number;
}

export interface LanguageCounts {
  python: number;
  typescript: number;
}

export interface TeamAnalyticsSummary {
  total_results: number;
  results_last_7d: number;
  results_last_30d: number;
  severity_counts: SeverityCounts;
  mode_counts: ModeCounts;
  language_counts: LanguageCounts;
  active_members_last_30d: number;
}

// ── Team Insights API Shapes ──────────────────────────────────────────────────

export interface DailyResultCount {
  date: string;  // ISO date YYYY-MM-DD
  count: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface SignatureCount {
  signature_hash: string;
  count: number;
}

export interface MemberActivityEntry {
  user_id: string;
  display_name: string | null;
  results_count: number;
}

export interface TeamInsights {
  daily_results_last_14d: DailyResultCount[];
  top_bug_categories_last_30d: CategoryCount[];
  top_signatures_last_30d: SignatureCount[];
  member_activity_last_30d: MemberActivityEntry[];
}

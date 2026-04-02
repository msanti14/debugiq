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

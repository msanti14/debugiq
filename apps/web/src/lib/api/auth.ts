/**
 * apps/web/src/lib/api/auth.ts
 * Auth endpoint wrappers.
 */

import type {
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  TokenResponse,
  LogoutRequest,
  RefreshRequest,
} from "@debugiq/shared-types";
import { apiFetch } from "./client";

export function login(body: LoginRequest): Promise<TokenResponse> {
  return apiFetch<TokenResponse>("/v0/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function register(body: RegisterRequest): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>("/v0/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function logout(body: LogoutRequest): Promise<void> {
  return apiFetch<void>("/v0/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function refresh(body: RefreshRequest): Promise<TokenResponse> {
  return apiFetch<TokenResponse>("/v0/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * apps/web/src/lib/auth/tokens.ts
 * Persistent token storage using localStorage.
 */

import type { TokenResponse } from "@debugiq/shared-types";

const KEY = "diq:tokens";

export function getTokens(): TokenResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TokenResponse;
  } catch {
    return null;
  }
}

export function setTokens(tokens: TokenResponse): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(tokens));
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

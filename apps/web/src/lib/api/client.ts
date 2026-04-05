/**
 * apps/web/src/lib/api/client.ts
 * Thin fetch wrapper with auth token injection and transparent refresh.
 */

import { getTokens, setTokens, clearTokens } from "@/lib/auth/tokens";

const API_URL =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const tokens = getTokens();
  if (!tokens?.refresh_token) return null;
  try {
    const res = await fetch(`${API_URL}/v0/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: tokens.refresh_token }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    setTokens(data);
    return data.access_token as string;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const tokens = getTokens();
  const headers = new Headers(init.headers);
  if (tokens?.access_token) {
    headers.set("Authorization", `Bearer ${tokens.access_token}`);
  }

  let res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      res = await fetch(`${API_URL}${path}`, { ...init, headers });
    } else {
      clearTokens();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("debugiq:auth:expired"));
      }
      throw new ApiError(401, "session_expired");
    }
  }

  if (!res.ok) {
    let detail = `http_error_${res.status}`;
    try {
      const body = await res.json();
      detail = body?.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

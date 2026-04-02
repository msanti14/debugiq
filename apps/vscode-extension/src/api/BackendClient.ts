import type { AuthService } from "../auth/AuthService";

/**
 * BackendClient — typed HTTP client for the DebugIQ FastAPI backend.
 *
 * Responsibilities:
 * - Inject Authorization header automatically
 * - Auto-refresh access token on 401 (one retry)
 * - Never accept or forward LLM API keys
 *
 * The apiBaseUrl is read from the DEBUGIQ_API_BASE_URL build-time constant,
 * which maps to the API_BASE_URL environment variable. In Phase 0 this is
 * the Railway-generated URL.
 */
export class BackendClient {
  private readonly baseUrl: string;
  // auth is set after construction to avoid circular dependency
  private auth: AuthService | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  setAuth(auth: AuthService): void {
    this.auth = auth;
  }

  async post<T>(path: string, body: unknown, accessToken?: string): Promise<T> {
    return this._request<T>("POST", path, body, accessToken);
  }

  async get<T>(path: string, accessToken?: string): Promise<T> {
    return this._request<T>("GET", path, undefined, accessToken);
  }

  async patch<T>(path: string, body: unknown, accessToken?: string): Promise<T> {
    return this._request<T>("PATCH", path, body, accessToken);
  }

  private async _request<T>(
    method: string,
    path: string,
    body: unknown,
    accessToken?: string,
    isRetry = false,
  ): Promise<T> {
    const token = accessToken ?? (await this.auth?.getAccessToken());
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${this.baseUrl}/v0${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && !isRetry && this.auth) {
      // Token expired — attempt one refresh, then retry
      const newToken = await this.auth.refreshTokens();
      return this._request<T>(method, path, body, newToken, true);
    }

    if (!res.ok) {
      const detail = await res.json().catch(() => ({ detail: res.statusText }));
      throw new BackendError(res.status, (detail as { detail?: string }).detail ?? res.statusText);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return res.json() as Promise<T>;
  }
}

export class BackendError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`BackendError ${status}: ${detail}`);
    this.name = "BackendError";
  }
}

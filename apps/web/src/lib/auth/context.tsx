"use client";
/**
 * apps/web/src/lib/auth/context.tsx
 *
 * AuthContext — provides current user state and auth actions (login, register,
 * logout) to the entire app via React context.
 *
 * Session lifecycle:
 *  1. On mount, reads stored tokens and fetches /v0/users/me to hydrate user.
 *  2. The API client handles transparent refresh on 401.
 *  3. The "debugiq:auth:expired" DOM event (fired by client.ts on failed refresh)
 *     triggers a hard logout here.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { UserResponse } from "@debugiq/shared-types";
import * as authApi from "@/lib/api/auth";
import { getMe } from "@/lib/api/users";
import { setTokens, clearTokens, getTokens } from "@/lib/auth/tokens";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuthState {
  user: UserResponse | null;
  /** True while we are hydrating from stored tokens on first mount. */
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  /** Re-fetches /v0/users/me and updates the user in context (e.g. after profile edit). */
  refreshUser: () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  // Hydrate user from stored tokens on mount.
  useEffect(() => {
    const tokens = getTokens();
    if (!tokens) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    getMe()
      .then((user) => setState({ user, loading: false, error: null }))
      .catch(() => {
        clearTokens();
        setState({ user: null, loading: false, error: null });
      });
  }, []);

  // Listen for hard expiry signals from the API client.
  useEffect(() => {
    const handler = () => {
      clearTokens();
      setState({ user: null, loading: false, error: null });
    };
    window.addEventListener("debugiq:auth:expired", handler);
    return () => window.removeEventListener("debugiq:auth:expired", handler);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const tokens = await authApi.login({ email, password });
      setTokens(tokens);
      const user = await getMe();
      setState({ user, loading: false, error: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "login_failed";
      setState((s) => ({ ...s, loading: false, error: msg }));
      throw err;
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        await authApi.register({
          email,
          password,
          display_name: displayName,
        });
        // Auto-login after register.
        const tokens = await authApi.login({ email, password });
        setTokens(tokens);
        const user = await getMe();
        setState({ user, loading: false, error: null });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "register_failed";
        setState((s) => ({ ...s, loading: false, error: msg }));
        throw err;
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    const tokens = getTokens();
    try {
      if (tokens?.refresh_token) {
        await authApi.logout({ refresh_token: tokens.refresh_token });
      }
    } catch {
      // Best-effort — clear local state regardless.
    } finally {
      clearTokens();
      setState({ user: null, loading: false, error: null });
    }
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const user = await getMe();
      setState((s) => ({ ...s, user }));
    } catch {
      // Best-effort — don't force logout on a profile refresh failure.
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, clearError, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}

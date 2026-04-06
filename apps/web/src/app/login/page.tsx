"use client";
/**
 * apps/web/src/app/login/page.tsx
 *
 * Login page — email/password form.
 * Calls useAuth().login(), then navigates to /dashboard on success.
 * Redirects already-authenticated users to /dashboard immediately.
 * Local `submitting` and `error` state are used for form UX so the
 * page is independently testable without relying on AuthContext internal state.
 */

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const { login, user, loading } = useAuth();

  // Redirect already-authenticated users away from the login page.
  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  // Prevent flash: render nothing while auth state is loading or a redirect
  // is in progress.
  if (loading || user) return null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Login failed. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0 p-4">
      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">DebugIQ</h1>
          <p className="mt-1 text-sm text-muted">Sign in to your account</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-white/5 bg-surface-1 p-6"
        >
          {/* Error banner */}
          {error && (
            <div
              role="alert"
              className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400"
            >
              {error}
            </div>
          )}

          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
          />

          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={submitting}
          />

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={submitting}
            disabled={submitting}
            className="mt-2 w-full"
          >
            Sign in
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-brand-500 hover:text-brand-400"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

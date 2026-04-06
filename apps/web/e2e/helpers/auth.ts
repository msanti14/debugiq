import type { Page } from "@playwright/test";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "diq:tokens";

export interface TestUser {
  email: string;
  password: string;
}

/**
 * Registers a fresh user via the API, logs them in to obtain tokens, then
 * injects those tokens into the browser's localStorage so the app hydrates
 * as authenticated.
 * Call this after a page.goto() so localStorage is on the correct origin.
 */
export async function registerAndStoreTokens(page: Page): Promise<TestUser> {
  const email = `e2e-${Date.now()}@e2etest.dev`;
  const password = "E2ePassword1!";

  // Step 1 — register
  const regRes = await fetch(`${API_URL}/v0/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!regRes.ok) {
    const body = await regRes.text();
    throw new Error(`Registration failed (${regRes.status}): ${body}`);
  }

  // Step 2 — login to obtain tokens (register endpoint does not return tokens)
  const loginRes = await fetch(`${API_URL}/v0/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    const body = await loginRes.text();
    throw new Error(`Login after register failed (${loginRes.status}): ${body}`);
  }

  const data = await loginRes.json();
  const tokens = {
    access_token: data.access_token as string,
    refresh_token: data.refresh_token as string,
  };

  // Navigate to the app origin first so localStorage is scoped correctly,
  // then inject tokens so the next navigation picks them up.
  await page.goto("/login");
  await page.evaluate(
    ({ tokens, key }) => localStorage.setItem(key, JSON.stringify(tokens)),
    { tokens, key: TOKEN_KEY },
  );
  // Navigate to /dashboard. The (app)/layout.tsx route guard will show a
  // spinner while auth hydrates (loading: true), then stay on /dashboard
  // once getMe() resolves and user is set. This is more reliable than
  // reloading /login and waiting for the LoginPage redirect useEffect.
  await page.goto("/dashboard");
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  // Also wait for the spinner to disappear (loading: false) so we know
  // auth is fully hydrated before returning.
  await page.waitForSelector('[data-testid="app-shell"], main', { timeout: 15000 }).catch(() => {});

  return { email, password };
}

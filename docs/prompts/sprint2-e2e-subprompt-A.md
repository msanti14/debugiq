# Sprint 2 — E2E with Playwright · Subprompt A: Install + create all files

## Objective

Install Playwright and create all configuration and test files.
**Do NOT run any tests. Do NOT start any servers. File creation only.**

---

## Context

You are working in the `apps/web` subdirectory of a Next.js 14 App Router monorepo.
Sprint 1 is complete. The web app has a working auth flow with 55 Vitest tests passing.

### Routes that exist

```
/                          → server redirect → /dashboard
/login                     → LoginPage (client form, useAuth().login())
/register                  → RegisterPage (client form, useAuth().register())
/(app)/dashboard           → DashboardPage  (protected: guard redirects → /login if !user)
/(app)/settings            → SettingsPage   (protected)
/(app)/results/[id]        → ResultDetailPage (protected)
```

### Auth infrastructure

- Route guard in `src/app/(app)/layout.tsx`: if `!loading && !user` → `router.replace('/login')`.
- `/login` and `/register` redirect to `/dashboard` if the user is already authenticated.
- Token storage: `localStorage` key `diq:tokens`, value `{ access_token, refresh_token }`.
- API base URL: env var `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`).
- Auth endpoints: `POST /v0/auth/register`, `POST /v0/auth/login`, `POST /v0/auth/logout`.

### Current test setup

- Unit/integration: Vitest + jsdom, all in `src/test/`. Do NOT modify `vitest.config.ts`.
- No Playwright installed yet.

### What is NOT in scope

- Any changes to existing source files (`src/`).
- Modifying existing Vitest tests or `vitest.config.ts`.
- Starting servers or running tests.

---

## Task 1 — Install Playwright

Run from `apps/web`:

```bash
pnpm add -D @playwright/test
npx playwright install chromium
```

---

## Task 2 — Create `playwright.config.ts`

Create `apps/web/playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

---

## Task 3 — Add `test:e2e` script to `package.json`

In `apps/web/package.json`, add inside `"scripts"`:

```json
"test:e2e": "playwright test"
```

---

## Task 4 — Create auth helper

Create `apps/web/e2e/helpers/auth.ts`:

```ts
import type { Page } from "@playwright/test";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "diq:tokens";

export interface TestUser {
  email: string;
  password: string;
}

/**
 * Registers a fresh user via the API (no browser), then injects the returned
 * tokens into the browser's localStorage so the app hydrates as authenticated.
 * Call this after page.goto() to an app URL so localStorage is on the right origin.
 */
export async function registerAndStoreTokens(page: Page): Promise<TestUser> {
  const email = `e2e-${Date.now()}@test.local`;
  const password = "E2ePassword1!";

  const res = await fetch(`${API_URL}/v0/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Registration failed (${res.status}): ${body}`);
  }

  const data = await res.json();

  // Handle both flat { access_token, refresh_token } and nested { tokens: { ... } } shapes.
  const tokens =
    "access_token" in data
      ? { access_token: data.access_token, refresh_token: data.refresh_token }
      : data.tokens;

  // Navigate to the app origin first so localStorage is scoped correctly.
  await page.goto("/login");
  await page.evaluate(
    ({ tokens, key }) => localStorage.setItem(key, JSON.stringify(tokens)),
    { tokens, key: TOKEN_KEY },
  );

  return { email, password };
}
```

---

## Task 5 — Create test suite

Create `apps/web/e2e/auth-flow.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { registerAndStoreTokens } from "./helpers/auth";

test("unauthenticated user visiting /dashboard is redirected to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForURL(/\/login/);
  await expect(page.locator('input[type="email"]')).toBeVisible();
});

test("user can log in with valid credentials and reach /dashboard", async ({ page }) => {
  const { email, password } = await registerAndStoreTokens(page);

  await page.goto("/login");
  // Clear the tokens that registerAndStoreTokens injected — we want to test the form flow.
  await page.evaluate((key) => localStorage.removeItem(key), "diq:tokens");

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  await page.waitForURL(/\/dashboard/);
  expect(page.url()).toContain("/dashboard");
});

test("login form shows error on wrong password", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[type="email"]', "nobody@example.com");
  await page.fill('input[type="password"]', "wrongpassword123");
  await page.click('button[type="submit"]');

  await expect(page.locator('[role="alert"]')).toBeVisible();
});

test("already-authenticated user visiting /login is redirected to /dashboard", async ({ page }) => {
  await registerAndStoreTokens(page);
  await page.goto("/login");
  await page.waitForURL(/\/dashboard/);
  expect(page.url()).toContain("/dashboard");
});

test("authenticated user can reach /dashboard and sees the app, not the login form", async ({ page }) => {
  await registerAndStoreTokens(page);
  await page.goto("/dashboard");
  await page.waitForURL(/\/dashboard/);
  expect(page.url()).toContain("/dashboard");
  await expect(page.locator('input[type="email"]')).not.toBeVisible();
});
```

---

## Task 6 — Add `.gitignore` entries

Create or update `apps/web/.gitignore` to include:

```
# Playwright
/playwright-report/
/test-results/
/e2e/screenshots/
```

---

## Acceptance criteria for this subprompt

- `pnpm add -D @playwright/test` completed successfully.
- `npx playwright install chromium` completed successfully.
- These files exist:
  - `apps/web/playwright.config.ts`
  - `apps/web/e2e/helpers/auth.ts`
  - `apps/web/e2e/auth-flow.spec.ts`
  - `apps/web/.gitignore` (with Playwright entries)
- `test:e2e` script added to `apps/web/package.json`.
- No files in `src/` modified.
- **Tests are NOT run in this subprompt.** That is handled in Subprompt B.

## Out of scope

- Running `pnpm test:e2e`.
- Starting or checking any servers.
- Any backend changes.
- Modifying Vitest config or existing tests.

# Sprint 2 — E2E smoke tests with Playwright

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

- Route guard lives in `src/app/(app)/layout.tsx`. If `!loading && !user` → `router.replace('/login')`.
- `/login` and `/register` redirect to `/dashboard` if the user IS already authenticated.
- Token storage: `localStorage` key `diq:tokens`, value `{ access_token, refresh_token }`.
- API base URL: `process.env.NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`).
- Endpoints used by auth: `POST /v0/auth/register`, `POST /v0/auth/login`, `POST /v0/auth/logout`.

### Current test setup

- Unit/integration tests: Vitest + jsdom + React Testing Library — all in `src/test/`.
- vitest.config.ts: environment `jsdom`, setupFiles `src/test/setup.ts`, include `src/test/**`.
- **No Playwright installed yet.** Do not modify vitest.config.ts.

### What is NOT in scope

- Any changes to existing source files (pages, components, context, API layer).
- Modifying existing Vitest tests or vitest.config.ts.
- CI/CD pipeline changes.
- Visual regression tests.
- Testing routes beyond the happy-path auth flows + dashboard smoke.

---

## Pre-check — confirm servers are running before implementing

Before writing any code, verify that both servers are reachable:

```bash
# Check API
curl -s http://localhost:8000/health | grep -q "ok" && echo "API OK" || echo "API NOT RUNNING"

# Check web dev server
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -qE "^(200|307|308)" && echo "WEB OK" || echo "WEB NOT RUNNING"
```

If either server is not running, start them before proceeding:

```bash
# Start API (from repo root)
cd apps/api && source .venv/bin/activate && uvicorn src.main:app --reload --port 8000

# Start web dev server (from repo root, separate terminal)
cd apps/web && pnpm dev
```

**Do not run `pnpm test:e2e` until both servers respond.** The `webServer` block in `playwright.config.ts` will manage the web server automatically in subsequent runs, but the API must always be started manually.

---

## Tasks

### Task 1 — Install and configure Playwright

Install Playwright as a dev dependency in `apps/web`. Use the `@playwright/test` package.

```bash
cd apps/web && pnpm add -D @playwright/test
```

Then install browser binaries (Chromium only is fine for now, to keep install size small):

```bash
cd apps/web && npx playwright install chromium
```

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

Add a `test:e2e` script to `apps/web/package.json`:

```json
"test:e2e": "playwright test"
```

### Task 2 — Shared test helper (auth fixture)

Create `apps/web/e2e/helpers/auth.ts`:

This helper must:
1. Register a fresh user via `POST /v0/auth/register` (using `fetch` directly, not via the browser).
2. Store the returned tokens in `localStorage` at key `diq:tokens` so the app hydrates as authenticated.
3. Use a unique email per test run (e.g. `e2e-${Date.now()}@test.local`) so tests never collide.

```ts
import type { Page } from "@playwright/test";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface TestUser {
  email: string;
  password: string;
}

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

  const data = (await res.json()) as { access_token: string; refresh_token: string } | { tokens: { access_token: string; refresh_token: string } };

  // Handle both flat and nested response shapes.
  const tokens = "access_token" in data ? data : (data as any).tokens;

  // Navigate to a blank page on the app's origin first, then inject tokens.
  await page.goto("/login");
  await page.evaluate(
    ({ tokens, key }) => localStorage.setItem(key, JSON.stringify(tokens)),
    { tokens, key: "diq:tokens" },
  );

  return { email, password };
}
```

> Note: check `apps/web/src/lib/auth/tokens.ts` at implementation time to confirm the exact localStorage key used. It is `diq:tokens` based on the current codebase.

### Task 3 — E2E test suite

Create `apps/web/e2e/auth-flow.spec.ts` with the following 5 tests:

#### Test 1 — Unauthenticated redirect

```
Scenario: visiting /dashboard while logged out redirects to /login
Steps:
  1. page.goto('/dashboard')
  2. Wait for URL to contain '/login'
  3. Assert page contains a form with an email input (confirms login page rendered)
```

#### Test 2 — Login happy path

```
Scenario: user can log in with valid credentials and reach /dashboard
Steps:
  1. Register a user directly via API (no browser), get credentials.
  2. page.goto('/login')
  3. Fill email input, fill password input, click submit button.
  4. Wait for URL to contain '/dashboard'
  5. Assert URL is '/dashboard' (no redirect back to login)
```

#### Test 3 — Login with wrong password shows error

```
Scenario: submitting wrong password shows an error message
Steps:
  1. page.goto('/login')
  2. Fill valid email, fill wrong password ("wrongpassword123"), click submit.
  3. Assert an element with role="alert" is visible.
```

#### Test 4 — Authenticated user is redirected away from /login

```
Scenario: already-authenticated user visiting /login is sent to /dashboard
Steps:
  1. Register user via API, store tokens in localStorage (use registerAndStoreTokens helper).
  2. page.goto('/login')
  3. Wait for URL to contain '/dashboard'
  4. Assert current URL contains '/dashboard'
```

#### Test 5 — Dashboard smoke test

```
Scenario: authenticated user can reach /dashboard and it is not the login page
Steps:
  1. Register user via API, store tokens in localStorage (use registerAndStoreTokens helper).
  2. page.goto('/dashboard')
  3. Assert URL contains '/dashboard'
  4. Assert the page does NOT contain an input[type="email"] (i.e. we are not on the login form)
```

### Task 4 — .gitignore additions

Add Playwright artifacts to `apps/web/.gitignore` (create it if it does not exist):

```
# Playwright
/playwright-report/
/test-results/
/e2e/screenshots/
```

---

## Acceptance criteria

- `cd apps/web && pnpm test:e2e` → 5 passed, 0 failed (against a running dev server and a running API).
- Existing `pnpm test` (Vitest) → still 55 passed, 0 regressions.
- `playwright.config.ts` and `e2e/` directory committed.
- No source files in `src/` modified.

## Out of scope

- Testing `/register` page E2E (covered by unit tests; login path covers the flow end-to-end).
- Testing `/(app)/settings` or `/(app)/results` pages.
- CI integration (GitHub Actions, Railway).
- Any backend changes.
- Screenshot / visual regression tests.
- Multiple browsers (Chromium only).

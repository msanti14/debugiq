# Sprint 3 — Web Release Hardening

## Context

You are working in the monorepo at `/home/estudiante/debugiq`.  
The Next.js 14.2.29 web app lives in `apps/web`.

**Current state (verified):**
- `pnpm build` → clean (0 errors, 0 warnings, 8 routes)
- `pnpm typecheck` → clean
- `pnpm lint` → clean
- `pnpm test` → 55 Vitest tests passing
- `pnpm test:e2e` → 5 Playwright tests passing
- **No `next.config.ts` exists** (none at all)
- **No `vercel.json` exists**
- `.env.local` exists (has a comment saying "Never commit .env.local") but `.env.local.example` does not
- Target deploy: Vercel (web), Railway (API)

## Objective

Harden the web app for production release without changing any existing functionality.  
All existing tests must continue passing after your changes.

---

## Tasks

### Task 1 — Create `apps/web/next.config.ts`

Create `apps/web/next.config.ts` with:

1. `reactStrictMode: true`
2. An async `headers()` function that adds security headers to all routes (`source: '/(.*)'`):
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
   - `X-DNS-Prefetch-Control: on`
   - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preloadValue` (this header is only meaningful over HTTPS; include it anyway for staging/prod)
3. No other changes — do not add experimental flags, do not touch images config, do not add rewrites.

Use the typed `NextConfig` export:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // ... your headers here
        ],
      },
    ]
  },
}

export default nextConfig
```

### Task 2 — Create `.env.local.example`

Create `apps/web/.env.local.example` with the following content (exactly):

```
# DebugIQ Web App — Environment Variables
# Copy this file to .env.local and fill in the values.
# NEVER commit .env.local to version control.

# URL of the FastAPI backend.
# Local development: http://localhost:8000
# Production (Railway): https://<your-railway-domain>
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Do not delete or modify the existing `apps/web/.env.local` file.

### Task 3 — Verify `.gitignore` covers `.env.local`

Check if `apps/web/.gitignore` (or the root `.gitignore`) already ignores `.env.local`.  
If it does not, add `.env.local` to the appropriate `.gitignore`.  
If it already does, make no change.

### Task 4 — Create `apps/web/vercel.json`

Create `apps/web/vercel.json` with:

```json
{
  "framework": "nextjs"
}
```

This is the minimal config needed for Vercel to correctly identify the framework.  
The `rootDirectory` is configured in Vercel's project settings (pointing to `apps/web`), not in this file.

### Task 5 — Add 3 tests to a new test file `apps/web/src/test/release-config.test.ts`

Create a new test file that verifies release configuration artifacts exist and are correct:

```
Test 1: ".env.local.example exists at the expected path"
  - Use Node's `fs.existsSync` to check that `apps/web/.env.local.example` exists relative to the repo root.
  - Pass if it exists.

Test 2: ".env.local.example contains NEXT_PUBLIC_API_URL"
  - Read the file and assert it contains the string "NEXT_PUBLIC_API_URL" 

Test 3: "next.config.ts exists"
  - Use `fs.existsSync` to check that `apps/web/next.config.ts` exists.
```

Use Vitest (`import { describe, it, expect } from 'vitest'`).  
Use `path.join` to resolve paths relative to `process.cwd()` (which Vitest runs from `apps/web`).

---

## Verification Steps

After making all changes, run:

```bash
cd apps/web

# 1. Build must still be clean
pnpm build

# 2. All unit tests including the 3 new ones must pass (expect 58 total)
pnpm test --run

# 3. Typecheck must still be clean
pnpm typecheck

# 4. Lint must still be clean
pnpm lint
```

Do NOT run the E2E tests (`pnpm test:e2e`) — they require a running server.

---

## Constraints

- Do NOT modify any existing source files in `src/app/`, `src/components/`, `src/lib/`, or `src/test/` (except adding the new test file).
- Do NOT change any auth logic, routing, or Tailwind configuration.
- Do NOT add any new npm dependencies.
- The `vercel.json` must be in `apps/web/`, not in the monorepo root.
- If `pnpm build` fails after your changes, debug and fix before finishing.
- The new test file `release-config.test.ts` is the only new test file allowed.

---

## Expected Deliverables

| File | Action |
|---|---|
| `apps/web/next.config.ts` | Create |
| `apps/web/.env.local.example` | Create |
| `apps/web/vercel.json` | Create |
| `apps/web/src/test/release-config.test.ts` | Create |
| `.gitignore` or `apps/web/.gitignore` | Modify only if `.env.local` is not already ignored |

**Total new tests: 3 (58 passing total after this sprint)**

# Sprint 1 — Step 2+3: Auth redirect inverse, Tailwind setup, and expanded tests

## Context

You are working in the `apps/web` subdirectory of a Next.js 14 App Router monorepo.
Step 1 was completed in the previous session and produced these files:

### Already created (do not modify unless instructed below)

- `src/app/layout.tsx` — root server layout, wraps `<AuthProvider>`
- `src/app/page.tsx` — root entry, `redirect('/dashboard')`
- `src/app/login/page.tsx` — client form, `useAuth().login()`, `router.replace('/dashboard')` on success
- `src/app/register/page.tsx` — client form, `useAuth().register()`, `router.replace('/dashboard')` on success
- `src/test/auth-pages.test.tsx` — 6 tests (3 per page), all passing, 51 total suite

### Already exists (do not modify)

- `src/app/(app)/layout.tsx` — route guard: if `!loading && !user` → `router.replace('/login')`. Works correctly. Do not touch.
- `src/lib/auth/context.tsx` — `useAuth()` exposes: `login`, `register`, `logout`, `user`, `loading`, `error`, `clearError`. Do not touch.
- `src/lib/auth/tokens.ts` — token storage. Do not touch.
- `src/lib/api/auth.ts` — backend API layer. Do not touch.
- `src/components/ui/Input.tsx` — already exists with `label`, `hint`, `error` props.
- `src/components/ui/Button.tsx` — already exists.
- `src/components/layout/Sidebar.tsx` — already has logout button calling `useAuth().logout()`. Do not modify.

### What is missing (this step's scope)

1. `src/app/login/page.tsx` and `src/app/register/page.tsx` do NOT currently redirect when the user is ALREADY authenticated. If a logged-in user visits `/login`, they see the form instead of being sent to `/dashboard`.
2. Tailwind CSS is installed (`tailwindcss@^3.4`, `postcss@^8.5`) but `tailwind.config.ts`, `postcss.config.js`, and `src/app/globals.css` are all absent. Without them, the browser renders unstyled HTML.
3. No tests exist for the already-authenticated redirect behavior.

---

## Tasks

### Task 1 — Auth redirect inverse in login and register pages

Modify `src/app/login/page.tsx` and `src/app/register/page.tsx` to redirect already-authenticated users to `/dashboard`.

Pattern to apply to both pages (destructure `user` and `loading` from `useAuth()`, add a `useEffect`, and early-return `null` to prevent flash):

```tsx
const { login, user, loading } = useAuth();
// (in register page: use `register` instead of `login`)

useEffect(() => {
  if (!loading && user) {
    router.replace("/dashboard");
  }
}, [user, loading, router]);

if (loading || user) return null;
```

- The `useEffect` must be called unconditionally (before any returns) to satisfy the Rules of Hooks.
- Do not add a loading spinner — `null` is fine to prevent flash.
- Do not change any other behavior of these pages.

### Task 2 — Tailwind CSS setup (browser rendering)

The design system uses these custom tokens throughout the codebase:

- `surface-0` — darkest background (page background)
- `surface-1` — card/panel background
- `surface-2` — hover / skeleton background
- `surface-3` — badge background
- `muted` — muted text / icon color
- `brand-400`, `brand-500`, `brand-900` — accent color scale

Create the following three files:

**`tailwind.config.ts`** (at `apps/web/tailwind.config.ts`):

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "surface-0": "#0d0d0f",
        "surface-1": "#141418",
        "surface-2": "#1c1c22",
        "surface-3": "#232329",
        muted: "#6b7280",
        brand: {
          400: "#a78bfa",
          500: "#8b5cf6",
          900: "#2e1065",
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

**`postcss.config.js`** (at `apps/web/postcss.config.js`):

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**`src/app/globals.css`** (at `apps/web/src/app/globals.css`):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

*, *::before, *::after {
  box-sizing: border-box;
}

body {
  background-color: #0d0d0f;
  color: #ffffff;
  margin: 0;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
```

Then update `src/app/layout.tsx` to import `globals.css`. Add this import as the very first import line:

```ts
import "./globals.css";
```

### Task 3 — Expanded tests for already-authenticated redirect

Add 4 more tests to the existing `src/test/auth-pages.test.tsx` (2 per page).

The mock at the top of the file already has `user: null`. You need two additional mock scenarios per page — one where `user` is a populated object and `loading` is false, and one where `loading` is true and `user` is null.

Tests to add:

**For LoginPage:**

- `"redirects to /dashboard when user is already authenticated"` — render with `useAuth` returning `{ user: { id: '1', email: 'a@b.com' }, loading: false, ... }`, expect `router.replace` to have been called with `'/dashboard'`
- `"renders null (no flash) during initial loading"` — render with `useAuth` returning `{ user: null, loading: true, ... }`, form element should not be in the document

**For RegisterPage:** same two tests, same logic.

The test file uses `vi.mock("@/lib/auth/context", ...)` with `vi.fn()`. You will need to change `vi.mock` to use a per-test override pattern (`mockReturnValue` or `mockImplementation` on the mock factory) OR add separate `describe` blocks with `beforeEach` overrides. Choose the approach that keeps the existing 6 tests green.

---

## Acceptance criteria

- `npx vitest run src/test/auth-pages.test.tsx` → 10 passed (was 6)
- `npx vitest run` → 55 passed (was 51), 0 failures, 0 regressions
- `src/app/login/page.tsx`: already-authenticated user is redirected immediately
- `src/app/register/page.tsx`: same
- `tailwind.config.ts`, `postcss.config.js`, `src/app/globals.css`, and `globals.css` import in `layout.tsx` all present
- Backend not touched, auth context not touched, route guard not touched

## Out of scope

- E2E / Playwright setup
- Any backend changes
- Any new UI components beyond what Step 1 already added
- Changing the route guard in `(app)/layout.tsx`
- `next.config.ts` or any Next.js build config

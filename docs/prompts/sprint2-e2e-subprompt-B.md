# Sprint 2 — E2E with Playwright · Subprompt B: Run the tests

## Precondition — YOU MUST CHECK THIS FIRST

Before doing anything else, verify that both servers are up and responding:

```bash
curl -s http://localhost:8000/health
curl -s -o /dev/null -w "WEB_STATUS:%{http_code}" http://localhost:3000
```

**If either server is down, stop immediately and report which one is not running.**
Do not attempt to start servers. Do not proceed with any other step.
The user will start them manually and re-run this prompt.

Expected results when servers are healthy:
- API: any JSON response (even `{"status":"degraded"}` is acceptable — the DB connection state does not matter, only that `/health` responds at all)
- Web: HTTP status 200, 307, or 308

---

## Context

Sprint 2 Subprompt A was already completed. These files now exist in `apps/web`:

- `playwright.config.ts` — Playwright config with `webServer` block (starts `pnpm dev` automatically)
- `e2e/helpers/auth.ts` — helper that registers a user via API and injects tokens into localStorage
- `e2e/auth-flow.spec.ts` — 5 tests: unauthenticated redirect, login happy path, wrong password error, authenticated redirect, dashboard smoke
- `package.json` has `"test:e2e": "playwright test"` script

The web dev server does NOT need to be running before `pnpm test:e2e` — the `webServer` block in `playwright.config.ts` starts it automatically.
The API server DOES need to be running on `http://localhost:8000`.

---

## Task — Run the tests

From `apps/web`, run:

```bash
pnpm test:e2e
```

Report the results exactly:
- How many tests passed / failed.
- Full output of any failing test including the error message.
- If all 5 pass, confirm: `5 passed, 0 failed`.

Also confirm Vitest is unaffected:

```bash
pnpm test
```

Expected: 55 passed, 0 regressions.

---

## If tests fail

For each failing test, diagnose and fix the root cause. Common issues to check:

1. **Selector mismatch** — the `input[type="email"]` or `button[type="submit"]` selectors may not match the rendered HTML. Check the actual DOM with `page.content()` and adjust selectors.
2. **Token shape mismatch** — the register endpoint may return a different JSON shape than `{ access_token, refresh_token }`. Log `data` in the helper to see the actual shape.
3. **Redirect timing** — `waitForURL` timeout may be too short. Add `{ timeout: 10000 }` if needed.
4. **Auth hydration timing** — after injecting tokens, the app may need a full reload to hydrate. Add `await page.reload()` after `localStorage.setItem` in the helper if tests 4 and 5 fail.

Fix only what is necessary to make the tests pass. Do not change existing source files in `src/`.

---

## Acceptance criteria

- `pnpm test:e2e` → 5 passed, 0 failed
- `pnpm test` → 55 passed, 0 regressions
- No files in `src/` modified

## Out of scope

- Adding new tests beyond the 5 defined in Subprompt A.
- Any backend changes.
- CI/CD setup.

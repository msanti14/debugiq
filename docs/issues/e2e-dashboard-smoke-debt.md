# E2E Dashboard Smoke Test Debt

**Type:** Tech debt  
**Priority:** Medium  
**Area:** QA / Testing  

## Summary

There is no end-to-end browser test covering the core dashboard flow. All current tests are unit/integration level (Vitest + pytest). A regression in routing, auth redirect, or API wiring can pass all unit tests and only surface in a real browser session.

## Current state

- `apps/web/` has no Playwright or Cypress configuration.
- No `e2e/` or `cypress/` directory exists in the repo.
- The `package.json` at `apps/web/` has no `test:e2e` script.
- 45 Vitest tests cover component-level behaviour but mock all API calls.

## Impact

- A broken login → dashboard → team → analytics flow would not be caught by CI.
- Release confidence relies entirely on manual smoke testing (currently documented in `docs/releases/`).
- As the feature surface grows, manual smoke coverage will become increasingly unreliable.

## Acceptance criteria

- [ ] Playwright (or Cypress) installed and configured under `apps/web/`.
- [ ] `test:e2e` script added to `apps/web/package.json`.
- [ ] Smoke suite covers the critical path:
  1. Register a new user (or log in with seeded credentials).
  2. Create a team.
  3. Submit a code analysis.
  4. Navigate to Team Insights and verify chart renders.
  5. Navigate to Team Analytics and verify metrics display.
- [ ] Suite runs against a local dev server (`vite preview` or `vite dev`).
- [ ] CI job added (GitHub Actions) that runs the E2E suite on PRs to `main`.

## Notes

- Playwright is preferred: already familiar in the project toolchain, better trace/debug story.
- A lightweight fixture that seeds a test user via `POST /auth/register` before each test run avoids coupling to UI auth flows before the login UI debt (see `web-login-register-ui-debt.md`) is resolved.
- Start with the happy path only; error-path E2E can be a follow-up.

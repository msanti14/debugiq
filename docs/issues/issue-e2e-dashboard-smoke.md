# Title
Add E2E browser smoke tests for team dashboard flow

## Summary
Current coverage is strong in unit/integration tests, but there is no browser-level E2E validation for the full team dashboard flow. Add a lightweight E2E smoke suite.

## Problem
- No automated browser path for key MVP journey.
- Regressions across API/web integration may slip through.
- Release confidence depends on manual checks.

## Scope
- Add E2E smoke tests for:
  1. Login (or session bootstrap if login UI is not yet shipped).
  2. Team scope selection.
  3. Dashboard loads analytics summary + insights.
  4. Selector changes (`days`, `top_n`) trigger refetch.
  5. Non-member API path remains forbidden (where applicable).
  6. Basic error/retry behavior for analytics panels.
- Integrate into CI as optional/nightly first, then required after stabilization.

## Acceptance Criteria
- At least one green end-to-end smoke path in CI artifacts.
- Failing API/web integration causes E2E failure.
- Test docs include local run command and troubleshooting notes.

## Out of Scope
- Full visual regression testing.
- Cross-browser matrix in first iteration.
- Performance benchmarking.

## Suggested Labels
- `web`
- `qa`
- `e2e`
- `mvp`

## Priority
Medium

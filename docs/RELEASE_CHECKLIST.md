# DebugIQ MVP Pre-Release Checklist

Use this checklist before each release build. All items must pass before tagging a release.

Current status: Apr 2026 release candidate completed (GO final).

---

## 1. Build & Package

- [x] `pnpm typecheck` passes with zero errors in `apps/vscode-extension`
- [x] `pnpm test` passes with all extension tests green
- [x] `pnpm build` produces `out/extension.js` without errors
- [x] `pnpm package` produces `debugiq-0.1.0.vsix` without errors
- [x] `.vsix` size is reasonable (< 5 MB; no `node_modules` or source files inside)
  - Verify: `unzip -l debugiq-*.vsix | head -40`

---

## 2. Installation Verification

- [x] Install the `.vsix` in VS Code: `code --install-extension debugiq-0.1.0.vsix`
- [x] Extension appears in Extensions sidebar as "DebugIQ"
- [x] Extension activates without errors (check Output → DebugIQ or Developer Tools console)
- [x] Command Palette shows `DebugIQ:` category with all 8 commands

---

## 3. Demo Mode

- [x] Open any file (or no file)
- [x] Run **DebugIQ: Run Demo Analysis**
- [x] DebugIQ sidebar opens and displays demo findings
- [x] No errors in Output panel

---

## 4. Quick Debug (requires GitHub Copilot)

- [x] Open a Python or TypeScript file
- [x] Select 10–30 lines of code with a deliberate bug
- [x] Run **DebugIQ: Quick Debug (AI)**
- [x] Progress notification appears ("Analyzing…")
- [x] Sidebar shows findings with severity badges
- [x] Signature hash is displayed in sidebar

---

## 5. Learn Debug (requires GitHub Copilot)

- [x] Select the same code from step 4
- [x] Run **DebugIQ: Learn Debug (AI with Explanations)**
- [x] Progress notification appears ("Teaching through this bug…")
- [x] Sidebar shows findings plus learning resources / explanations

---

## 6. Copilot-Unavailable Fallback

- [x] Disable GitHub Copilot extension
- [x] Run **DebugIQ: Quick Debug (AI)**
- [x] Notification: "GitHub Copilot is not available… Showing demo result."
- [x] Sidebar shows demo fixture — no crash, no stack trace

---

## 7. First-Run Onboarding

- [x] Install extension fresh (or clear `globalState` key `debugiq.firstRunShown`)
- [x] On first activation: welcome notification appears with "Run Demo" and "Show Commands" buttons
- [x] "Run Demo" triggers demo analysis
- [x] "Show Commands" opens command palette pre-filtered to `DebugIQ`
- [x] Notification does NOT appear on subsequent reloads

---

## 8. Pre-Commit Hook

- [x] Open a git repo workspace
- [x] Run **DebugIQ: Install Pre-Commit Hook**
- [x] Confirmation: "Pre-commit hook installed (warn-only)…"
- [x] `.git/hooks/pre-commit` exists and is executable (`ls -la .git/hooks/pre-commit`)
- [x] Make a commit — hook runs, may warn, but **never blocks** the commit
- [x] Verify hook script is POSIX-safe under `#!/bin/sh` (no bash-only expansions like `${VAR:0:16}`)
- [x] Run outside a git repo → error message: "No .git/hooks directory found. Is this a git repository?"
- [x] Run with no workspace → warning: "No workspace folder open."

---

## 9. Error States

- [x] Run Quick/Learn Debug with no file open → "Open a file in the editor first…"
- [x] Run Quick/Learn Debug with no selection → "Select some code in the editor first."
- [x] These messages contain no stack traces or raw exception text

---

## 10. Privacy Verification

- [x] Run Quick Debug with real code; open **Developer Tools → Network** in VS Code
- [x] Confirm no request goes to DebugIQ backend containing raw source code
- [x] Only requests: `POST /results` (if logged in) with `code_hash` (hashed), `POST /analytics/events` with anonymized signature hash
- [x] If logged out: no backend requests at all during analysis

---

## 11. Backend / Railway Health (if backend is deployed)

- [x] `GET <RAILWAY_URL>/health` returns `{"status": "ok"}`
- [x] `POST /results` accepts a valid payload and returns `201`
- [x] `POST /analytics/events` accepts a valid payload and returns `201`

---

## 12. Manual QA Matrix

| Scenario | Demo | Quick | Learn | Hook |
|---|---|---|---|---|
| Python file selected | ✓ | ✓ | ✓ | — |
| TypeScript file selected | ✓ | ✓ | ✓ | — |
| Non-code file (Markdown) | ✓ | ✓ (defaults to python) | ✓ (defaults to python) | — |
| No file open | ✓ | Warn | Warn | — |
| No selection | ✓ | Warn | Warn | — |
| No Copilot | ✓ | Demo fallback | Demo fallback | — |
| Inside git repo | — | — | — | Installs |
| Outside git repo | — | — | — | Error msg |

---

## Sign-off

- [x] All checklist items above pass
- [x] Version in `package.json` is correct
- [x] `CHANGELOG` or release notes updated (if applicable)
- [x] `.vsix` artifact archived for distribution

Latest release evidence:
- Date: 2026-04-03
- Status: GO final
- Hook fix commit: `63ecda9`
- Hook smoke test: warnings printed, no `Bad substitution`, commit remains warn-only

---

## 13. Web App MVP Iteration Checklist (Updated: 2026-04-05)

This section tracks current web app progress to allow pause/resume across days.

### Completed (all passes green as of 2026-04-05)

- [x] Teams scaffold and membership flows integrated in API/web contracts
- [x] Team analytics summary endpoint integrated in dashboard
- [x] Team insights endpoint integrated in dashboard insights panel
- [x] Analytics query/perf hardening:
  - [x] SQL aggregation paths improved (N+1 removed in member activity path)
  - [x] Composite indexes on `analysis_results` for analytics-heavy queries
  - [x] Responsive layout for insights cards (`grid-cols-1 md:grid-cols-2`)
- [x] Team Analytics v3 controls merged:
  - [x] `days` query parameter support (whitelist: 7, 14, 30, 90)
  - [x] `top_n` query parameter support (range: 1–50)
  - [x] Range/top-N selectors in web UI with automatic refetch
- [x] Web polish pass:
  - [x] Animated loading skeletons for both analytics panels
  - [x] Error cards with `role="alert"`, retry button, and retry state
  - [x] `<h3>` section headers (semantic correctness)
  - [x] `PillSelector` gains `disabled` prop, `aria-pressed`, `focus-visible` ring
  - [x] `EmptyNote` styled as italic muted text
- [x] Permission/validation hardening:
  - [x] Auth + membership checks run before query-param validation (non-members cannot probe via 422 vs 403)
  - [x] `CreateTeamRequest.name` validation (strip, min 1, max 100)
  - [x] `active_members_last_30d` always uses strict 30-day cutoff (not `days` param)
  - [x] `code_hash` hex charset validation (rejects non-hex 64-char strings)
  - [x] `top_n` manual bounds check (1–50) after auth
- [x] Observability:
  - [x] `team_insights_selector_changed` event type added to analytics endpoint
  - [x] `days` + `top_n` properties added to `AnalyticsProperties` (schema remains closed)
  - [x] `apps/web/src/lib/api/analytics.ts` — fire-and-forget event helper
  - [x] `TeamInsightsPanel` fires event on selector change (not on mount)

### Pending for next iteration

- [ ] Real login/register UI (web app currently requires token injection for auth)
- [ ] E2E browser tests (Playwright/Cypress) for full dashboard flow
- [ ] Staging deployment and smoke test against Railway / Vercel
- [ ] Tag and commit Pass 5 (polish/hardening/observability) changes
- [ ] Consider `active_members_last_30d` rename/clarification in API response

### Release checkpoint doc

See [`docs/releases/web-mvp-checkpoint-2026-04-05.md`](releases/web-mvp-checkpoint-2026-04-05.md) for full release notes, smoke test checklist, and rollback plan.

---

## 14. Tomorrow Start Checklist (Fast Resume)

- [ ] Sync local main: `git checkout main && git pull origin main`
- [ ] Commit Pass 5 (polish/hardening/observability) if not yet done:
  - `git add -A && git commit -m "feat(web): polish, permission hardening, and selector observability"`
- [ ] Run baseline validation before edits:
  - `pnpm --filter @debugiq/web typecheck`
  - `pnpm --filter @debugiq/web test`
  - `cd apps/api && . .venv/bin/activate && pytest -q`
- [ ] Execute next slice and keep PR scoped to one objective
- [ ] Open PR with explicit test evidence and rollback note

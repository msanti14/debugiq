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

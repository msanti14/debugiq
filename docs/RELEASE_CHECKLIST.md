# DebugIQ MVP Pre-Release Checklist

Use this checklist before each release build. All items must pass before tagging a release.

---

## 1. Build & Package

- [ ] `pnpm typecheck` passes with zero errors in `apps/vscode-extension`
- [ ] `pnpm test` passes: 156/156 extension tests green
- [ ] `pnpm build` produces `out/extension.js` without errors
- [ ] `pnpm package` produces `debugiq-0.1.0.vsix` without errors
- [ ] `.vsix` size is reasonable (< 5 MB; no `node_modules` or source files inside)
  - Verify: `unzip -l debugiq-*.vsix | head -40`

---

## 2. Installation Verification

- [ ] Install the `.vsix` in VS Code: `code --install-extension debugiq-0.1.0.vsix`
- [ ] Extension appears in Extensions sidebar as "DebugIQ"
- [ ] Extension activates without errors (check Output → DebugIQ or Developer Tools console)
- [ ] Command Palette shows `DebugIQ:` category with all 8 commands

---

## 3. Demo Mode

- [ ] Open any file (or no file)
- [ ] Run **DebugIQ: Run Demo Analysis**
- [ ] DebugIQ sidebar opens and displays demo findings
- [ ] No errors in Output panel

---

## 4. Quick Debug (requires GitHub Copilot)

- [ ] Open a Python or TypeScript file
- [ ] Select 10–30 lines of code with a deliberate bug
- [ ] Run **DebugIQ: Quick Debug (AI)**
- [ ] Progress notification appears ("Analyzing…")
- [ ] Sidebar shows findings with severity badges
- [ ] Signature hash is displayed in sidebar

---

## 5. Learn Debug (requires GitHub Copilot)

- [ ] Select the same code from step 4
- [ ] Run **DebugIQ: Learn Debug (AI with Explanations)**
- [ ] Progress notification appears ("Teaching through this bug…")
- [ ] Sidebar shows findings plus learning resources / explanations

---

## 6. Copilot-Unavailable Fallback

- [ ] Disable GitHub Copilot extension
- [ ] Run **DebugIQ: Quick Debug (AI)**
- [ ] Notification: "GitHub Copilot is not available… Showing demo result."
- [ ] Sidebar shows demo fixture — no crash, no stack trace

---

## 7. First-Run Onboarding

- [ ] Install extension fresh (or clear `globalState` key `debugiq.firstRunShown`)
- [ ] On first activation: welcome notification appears with "Run Demo" and "Show Commands" buttons
- [ ] "Run Demo" triggers demo analysis
- [ ] "Show Commands" opens command palette pre-filtered to `DebugIQ`
- [ ] Notification does NOT appear on subsequent reloads

---

## 8. Pre-Commit Hook

- [ ] Open a git repo workspace
- [ ] Run **DebugIQ: Install Pre-Commit Hook**
- [ ] Confirmation: "Pre-commit hook installed (warn-only)…"
- [ ] `.git/hooks/pre-commit` exists and is executable (`ls -la .git/hooks/pre-commit`)
- [ ] Make a commit — hook runs, may warn, but **never blocks** the commit
- [ ] Run outside a git repo → error message: "No .git/hooks directory found. Is this a git repository?"
- [ ] Run with no workspace → warning: "No workspace folder open."

---

## 9. Error States

- [ ] Run Quick/Learn Debug with no file open → "Open a file in the editor first…"
- [ ] Run Quick/Learn Debug with no selection → "Select some code in the editor first."
- [ ] These messages contain no stack traces or raw exception text

---

## 10. Privacy Verification

- [ ] Run Quick Debug with real code; open **Developer Tools → Network** in VS Code
- [ ] Confirm no request goes to DebugIQ backend containing raw source code
- [ ] Only requests: `POST /results` (if logged in) with `code_hash` (hashed), `POST /analytics/events` with anonymized signature hash
- [ ] If logged out: no backend requests at all during analysis

---

## 11. Backend / Railway Health (if backend is deployed)

- [ ] `GET <RAILWAY_URL>/health` returns `{"status": "ok"}`
- [ ] `POST /results` accepts a valid payload and returns `201`
- [ ] `POST /analytics/events` accepts a valid payload and returns `201`

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

- [ ] All checklist items above pass
- [ ] Version in `package.json` is correct
- [ ] `CHANGELOG` or release notes updated (if applicable)
- [ ] `.vsix` artifact archived for distribution

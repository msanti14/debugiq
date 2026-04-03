# DebugIQ

AI-aware debugging for teams that use AI to code.

## Features

DebugIQ gives you three ways to debug — no API keys required for the happy path:

| Command | What it does | Requires |
|---|---|---|
| **DebugIQ: Run Demo Analysis** | Instant demo with canned results — always works | Nothing |
| **DebugIQ: Quick Debug (AI)** | Fast AI triage of selected code | GitHub Copilot |
| **DebugIQ: Learn Debug (AI with Explanations)** | Deep explanation + learning resources | GitHub Copilot |

Results appear in the **DebugIQ sidebar**. Quick Debug and Learn Debug use **GitHub Copilot** via the VS Code Language Model API — your code is analyzed locally by Copilot, never sent to DebugIQ servers.

## Getting Started

1. Open a file and select some code.
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
3. Type `DebugIQ` to see all available commands.
4. Run **DebugIQ: Run Demo Analysis** to try it immediately, or **DebugIQ: Quick Debug** if Copilot is installed.

## Pre-Commit Hook

Run **DebugIQ: Install Pre-Commit Hook** to add a warn-only hook to your git repo. It surfaces repeated bug patterns at commit time but **never blocks a commit**.

## Privacy

- No raw source code is sent to DebugIQ servers.
- Analysis is performed locally by GitHub Copilot.
- Only anonymized bug-signature hashes are stored (opt-in, requires login).

## Requirements

- VS Code 1.90+
- GitHub Copilot extension (for Quick Debug and Learn Debug; Demo mode works without it)

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `debugiq.apiBaseUrl` | *(production URL)* | Override backend URL for local development |
| `debugiq.signature.enabled` | `true` | Enable bug signature tracking |
| `debugiq.signature.sensitivity` | `balanced` | Rule sensitivity: `strict` or `balanced` |
| `debugiq.hook.warnOn` | `new-signature` | When the pre-commit hook warns |

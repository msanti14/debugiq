# Changelog

All notable changes to this project will be documented in this file.

## 0.1.2 - 2026-04-03

- Fixed Copilot model selection fallback when strict model family matching returns no results.
- Improved compatibility across Copilot accounts where model IDs/families differ.

## 0.1.1 - 2026-04-03

- Added Spanish output support for user-facing notifications and sidebar labels.
- Added `debugiq.outputLanguage` setting with `auto`, `en`, and `es` options.
- Localized signature rule suggestions for Spanish-speaking developers.

## 0.1.0 - 2026-04-03

- Initial Marketplace release candidate.
- Added Demo Analysis, Quick Debug, and Learn Debug commands.
- Added secure auth flows (login/logout/refresh) using VS Code SecretStorage.
- Added bug signature tracking and warn-only pre-commit hook installer.
- Added sidebar UX for findings, fallback behavior when Copilot is unavailable, and first-run onboarding.

# Title
Web app: implement login/register flow for MVP

## Summary
The web app currently requires token injection/manual auth setup to use team dashboard features. Implement first-class login/register UI and session bootstrap for MVP usability.

## Problem
- No user-facing auth pages in `apps/web`.
- Manual token setup blocks realistic smoke/staging workflows.
- Increases friction for internal demos and QA.

## Scope
- Add login and register pages in `apps/web`.
- Connect to existing API endpoints:
  - `POST /v0/auth/register`
  - `POST /v0/auth/login`
  - refresh/logout flow already available via API client/auth context.
- Persist session using existing token strategy in web app.
- Redirect authenticated users to dashboard.
- Show clear validation and error messages.

## Acceptance Criteria
- User can register and login from web UI without manual token injection.
- Authenticated session survives refresh according to current token strategy.
- Logout works and clears session.
- Existing dashboard/team flows remain functional.
- Tests added for success + error states.

## Out of Scope
- Billing/tier enforcement.
- Dojo onboarding.
- New auth backend contracts.

## Suggested Labels
- `web`
- `auth`
- `mvp`

## Priority
Medium

# Web Login / Register UI Debt

**Type:** Tech debt  
**Priority:** High  
**Area:** Frontend / Auth  

## Summary

The web app has no real login or registration UI. Currently, authenticated access requires manually injecting a JWT token (e.g. via `localStorage` in browser DevTools or a helper script). This blocks any end-user or QA testing of the full browser flow without developer intervention.

## Current state

- `apps/web/` contains no `/login`, `/register`, or `/forgot-password` routes.
- Auth token is assumed to already be present in `localStorage` under the key `token`.
- The `AuthContext` reads this value on mount but provides no mechanism for a user to obtain it through the UI.
- API endpoints (`/auth/register`, `/auth/login`) are fully implemented in `apps/api/` and tested.

## Impact

- No user can self-serve onboard without developer help.
- Manual QA of any team/analytics feature requires token injection every session.
- Blocks external demo / stakeholder review of the web MVP.

## Acceptance criteria

- [ ] `/register` page: email + password fields, calls `POST /auth/register`, stores token on success, redirects to dashboard.
- [ ] `/login` page: email + password fields, calls `POST /auth/login`, stores token on success, redirects to dashboard.
- [ ] Protected routes redirect unauthenticated users to `/login`.
- [ ] "Log out" action clears token and redirects to `/login`.
- [ ] Unit tests cover the new auth forms (happy path + error states).

## Notes

- API contract is stable; no backend changes required.
- Existing `AuthContext` in `apps/web/src/context/AuthContext.tsx` can be extended rather than replaced.
- Consider React Router `<Navigate>` guards already partially in place.

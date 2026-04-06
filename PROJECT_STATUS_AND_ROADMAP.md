# DebugIQ — Project Status and Roadmap
**Version 2.0 · Updated 2026-04-05**

---

## Executive Summary

DebugIQ is no longer in an initial scaffolding phase. The project already has a working monorepo, a deployed FastAPI backend on Railway, a functional VS Code extension, and a web dashboard with team analytics and insights.

The current state is best described as:

- Phase 0 foundation: complete
- Team analytics MVP: complete
- Product polish and launch readiness: current phase
- Web usability and end-to-end confidence: next execution focus

---

## Current Phase

### Active phase

**Product polish and launch readiness**

This means the core platform exists and works, but the main gaps are now around product usability, release confidence, and operational completeness rather than core infrastructure.

### Why this is the right framing

- The backend already supports auth, results persistence, teams, analytics events, and team-scoped insights.
- The VS Code extension already has demo mode, secure token storage, backend integration, and analyzer orchestration.
- The web app already exposes dashboard value through team analytics and insights panels.
- CI, migrations, release notes, rollback notes, and smoke documentation now exist.
- The main blockers to a more complete MVP are on web auth UX and browser-level E2E validation.

---

## Status Snapshot

### What is working now

- Monorepo structure is active and stable across `apps/api`, `apps/web`, `apps/vscode-extension`, and `packages/shared-types`.
- API auth flows are implemented and tested: register, login, refresh, logout.
- User profile endpoints are implemented.
- Results persistence and listing are implemented.
- Teams workflows are implemented: team creation, listing, membership, and team-scoped access.
- Team analytics and team insights are implemented end-to-end.
- Analytics v3 is merged with query controls (`days`, `top_n`) and database indexes for heavier read paths.
- Web analytics panels now include better loading, error, empty, and retry states.
- Lightweight observability was added for selector usage in the web team insights panel.
- Release checkpoint documentation was created, including smoke and rollback guidance.
- Railway database migration for analytics indexes has already been applied successfully.

### What is verified

- Automated tests passed during the latest checkpoint:
  - backend: 79 tests green
  - web: 45 tests green
  - later consolidated run: 124 tests green
- Web MVP release notes exist.
- Operational playbook and follow-up debt issues were created.

### What is still missing

- Web login and registration UI do not exist yet.
- Protected browser auth flow is not complete for real end users.
- There is no browser-level E2E smoke suite yet.
- Web deployment/release confidence is still weaker than API confidence.

---

## Stream Status

### Stream A — Platform and CI hardening

**Status:** in progress, but healthy baseline established

Completed:

- Monorepo and shared types are in place.
- CI is stable across API, web, extension, and shared packages.
- Railway-backed API deployment is working.
- Alembic migration flow is active and already used for post-MVP index improvements.

Remaining useful hardening:

- stronger release automation for web
- browser-level regression coverage
- better environment/deploy visibility for the web app

### Stream B — Team analytics UX and performance

**Status:** MVP complete

Completed:

- team analytics endpoints implemented
- team insights endpoints implemented
- validation hardening for analytics query params
- auth ordering fixed before validation in team-scoped routes
- web selectors for time range and top-N
- analytics event tracking for selector changes
- composite indexes added for analytics-heavy queries
- dashboard empty/loading/error state polish completed

### Stream C — Product polish and launch readiness

**Status:** active now

Focus areas:

- web auth usability
- E2E smoke confidence
- final release ergonomics for web
- reducing developer-only workarounds for demos and QA

---

## Delivered Milestones

### Completed foundation milestones

- deployable FastAPI backend
- PostgreSQL on Railway
- auth and token lifecycle
- results persistence
- shared contract package
- VS Code extension demo and auth integration

### Completed web/team milestones

- team CRUD and access flows in backend
- team-scoped analytics and insights
- responsive team analytics panels in web
- retry and empty states for analytics cards
- query controls and contract tests for analytics v3

### Completed release-prep milestones

- release checkpoint notes
- rollback instructions
- migration for composite indexes
- operational playbook
- follow-up GitHub issues for known debt

---

## Open Product Gaps

### Gap 1 — Web auth experience

Current reality: the backend auth API exists, but the web app still depends on manual token injection for authenticated use.

Impact:

- blocks normal user onboarding
- makes QA and demos unnecessarily manual
- prevents calling the web app truly MVP-ready from a product perspective

### Gap 2 — End-to-end confidence

Current reality: unit and integration coverage is good, but there is no browser E2E suite covering the happy path.

Impact:

- routing, auth redirect, and real API wiring regressions can slip through
- release confidence depends too much on manual smoke testing

### Gap 3 — Web release maturity

Current reality: API release discipline is ahead of web release discipline.

Impact:

- the backend is easier to trust than the end-user product surface
- final launch readiness depends on improving browser-side delivery and validation

---

## Recommended Next Roadmap

### Sprint 1 — Web auth completion

Goal: make the web app usable without developer intervention.

Scope:

- add `/login` page
- add `/register` page
- persist token on successful auth
- add route protection and redirect unauthenticated users to login
- add logout action
- add focused unit tests for auth UI flows

Definition of done:

- a new user can register from the browser and reach the dashboard
- an existing user can log in from the browser and reach the dashboard
- protected routes redirect correctly
- logout clears session and returns user to login

### Sprint 2 — E2E smoke foundation

Goal: validate the real browser happy path.

Scope:

- add Playwright to `apps/web`
- add `test:e2e` script
- cover login or seeded-user entry path
- cover create team flow
- cover submit analysis flow if practical in local environment, or seed it if not
- verify Team Insights and Team Analytics render in browser

Definition of done:

- one happy-path browser suite runs locally and is repeatable
- failures provide enough signal to debug real routing/API regressions

### Sprint 3 — Web release hardening

Goal: make web delivery operationally safer.

Scope:

- define web deployment target and minimal promotion flow
- document required env vars and smoke checks
- align release checklist with the new auth and E2E reality
- optionally wire E2E smoke into CI for PRs or a protected branch flow

Definition of done:

- web deployment path is explicit
- smoke checks are shorter and more reliable
- regression risk is lower before merge/release

### Sprint 4 — Product expansion after usability baseline

Possible candidates:

- richer dashboard tables and filters
- better onboarding and first-run empty states
- profile/settings improvements
- cross-surface polish between extension and web

---

## Recommended Execution Order

1. Finish web auth UI first.
2. Add browser E2E smoke second.
3. Harden web release flow third.
4. Expand product features only after those three are done.

### Reasoning

- Without web auth UI, the product still feels developer-operated.
- Without E2E, passing tests do not guarantee the browser journey works.
- Without better release discipline, each new feature adds risk faster than value.

---

## Working Assumptions

- LLM calls continue to happen only in the VS Code extension, never in the backend.
- Backend continues storing metadata and findings, not raw source code.
- Shared contracts remain the integration boundary between surfaces.
- Current team analytics architecture is good enough for the next short cycle.
- Billing, tier enforcement, dojo/progress mechanics, and larger product breadth remain out of scope for the immediate next sprint.

---

## Immediate Next Actions

1. Approve this document as the new source of truth for current project status.
2. Convert Sprint 1 through Sprint 3 into a short execution roadmap with task slices.
3. Decide the execution style for the next sprint:
   - OpenCode-driven implementation with review checkpoints
   - direct implementation in this workspace
   - hybrid flow: prompts for larger chunks, direct fixes here for review and cleanup

---

## Historical Note

This file replaces the old `PHASE_0_PLAN.md` framing because that name no longer reflects the actual maturity of the repository. The project has moved from foundation work into MVP completion and launch-readiness work.

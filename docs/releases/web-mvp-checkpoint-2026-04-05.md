# Web MVP Checkpoint — 2026-04-05

**Status:** GO for internal review / pre-staging validation.
**Scope:** Web app team analytics dashboard (API + web). VS Code extension is unchanged.

---

## 1. What Shipped in This Checkpoint

This checkpoint closes four sequential passes that took the team analytics dashboard from raw scaffold to a polished, hardened, and instrumented MVP state.

### Pass 1 — Teams Scaffold & Selector (PR #4 · `c560c99`)

- API: `Team`, `TeamMember` models; CRUD endpoints (`POST /v0/teams`, `GET /v0/teams`, `GET /v0/teams/{id}`, `POST /v0/teams/{id}/members`). Results filterable by `team_id`.
- Web: `WorkspaceContext` team selector in sidebar; `apiFetch` client with JWT refresh; shared-types team shapes; full Vitest/jsdom test infra.

### Pass 2 — Team Analytics Summary (PR #5 · `39b2f8d`)

- API: `GET /v0/teams/{id}/analytics/summary` — results count by days window, severity breakdown, mode/language splits, active member count.
- Web: `TeamAnalyticsPanel` component rendered in dashboard.

### Pass 3 — Team Insights (PR #6 · `4dd92fe`)

- API: `GET /v0/teams/{id}/analytics/insights` — daily activity trend (14-day), top bug categories, top signatures, member activity ranking.
- Web: `TeamInsightsPanel` component with pill selectors for `days` and `top_n`.
- Shared types: `TeamInsights` shape added to `@debugiq/shared-types`.

### Pass 4 — Analytics v3 Controls (PR #7 + PR #8 · `342b99d`, `2eafead`)

- API: `days` and `top_n` query params on both analytics endpoints; composite indexes on `analysis_results(team_id, created_at)`, `analysis_results(team_id, severity)`, `analysis_results(team_id, language)`, `analysis_results(team_id, mode)`.
- Web: pill selector controls wired to query params with automatic refetch.

### Pass 5 — Polish, Hardening & Observability (uncommitted · this session)

This pass was not merged as a numbered PR. All changes are uncommitted on `main`.

#### UI Polish
- `TeamAnalyticsPanel`: replaced bare "Loading analytics…" text with an animated multi-section skeleton (`AnalyticsSkeleton`); improved error state with `role="alert"`, red border card, and "Try again" retry button; `<p>` section headers promoted to `<h3>` for semantic correctness.
- `TeamInsightsPanel`: same skeleton/error/retry treatment as above; `InsightsSkeleton` uses fixed bar heights (no `Math.random`, deterministic across renders); `EmptyNote` styled as italic muted text; `PillSelector` gains `disabled` prop + `aria-pressed` + `focus-visible` ring.

#### Permission/Validation Hardening
- `apps/api/src/teams/router.py`: auth + team membership checks now run **before** query-param whitelist validation on both `/analytics/summary` and `/analytics/insights`. Non-members cannot distinguish 403 vs 422 by probing with invalid params.
- `apps/api/src/teams/router.py`: `CreateTeamRequest.name` validated (strip whitespace, min 1 char, max 100 chars).
- `apps/api/src/teams/router.py`: `active_members_last_30d` now always uses a strict 30-day cutoff (`cutoff_30d`) regardless of the `days` query param. Previously it incorrectly applied the `days` param to the 30-day member count.
- `apps/api/src/results/router.py`: `code_hash` hex charset validation added — previously accepted any 64-character string; now rejects non-hex characters.

#### Observability
- `apps/api/src/analytics/router.py`: `"team_insights_selector_changed"` added to `ALLOWED_EVENT_TYPES`; `days: int | None` and `top_n: int | None` added to `AnalyticsProperties` (schema remains `extra="forbid"`).
- `apps/web/src/lib/api/analytics.ts` (new file): fire-and-forget `postAnalyticsEvent` wrapper over `apiFetch`. Errors swallowed silently.
- `apps/web/src/components/teams/TeamInsightsPanel.tsx`: `postAnalyticsEvent("team_insights_selector_changed", {days, top_n})` called in both `PillSelector` `onChange` handlers. Does not fire on initial mount.

---

## 2. Files/Areas Impacted

### Backend (`apps/api`)

| File | Change type |
|---|---|
| `src/analytics/router.py` | New event type + two new properties |
| `src/teams/router.py` | Auth ordering; name validation; `active_members` fix; `top_n` bounds |
| `src/results/router.py` | `code_hash` hex charset check |
| `src/db/models.py` | Composite indexes on `analysis_results` |
| `tests/test_analytics.py` | +4 new tests |
| `tests/test_teams.py` | +15 new tests (name validation, auth ordering, `active_members`, `code_hash`, `top_n`) |

### Web (`apps/web`)

| File | Change type |
|---|---|
| `src/lib/api/analytics.ts` | New file |
| `src/components/teams/TeamAnalyticsPanel.tsx` | Skeleton, retry, `h3`, `aria` |
| `src/components/teams/TeamInsightsPanel.tsx` | Skeleton, retry, `h3`, `aria`, analytics calls |
| `src/test/team-analytics.test.tsx` | +3 new tests (retry button, skeleton, error state) |
| `src/test/team-insights-v3.test.tsx` | +3 new tests (analytics event emission) |
| `src/test/team-insights.test.tsx` | Minor label fix (`"Range selector"` → `"Time range"`) |

### Shared types / infra

No changes to `packages/shared-types` or CI in this pass.

---

## 3. Known Limitations / Residual Risks

| # | Area | Description | Severity |
|---|---|---|---|
| 1 | Web auth | No real login/register UI yet; web app is accessible only via hardcoded token injection or direct API calls. | Medium |
| 2 | Observability | `postAnalyticsEvent` is fire-and-forget and silently swallowed. No delivery guarantee, no retry. Missed events are invisible. | Low |
| 3 | `active_members_last_30d` | The `days`-param fix is a semantic clarification only. If callers relied on `active_members` tracking the `days` window, this is a behavioural break. | Low |
| 4 | Composite indexes | Indexes are defined in SQLAlchemy model metadata. They do not auto-apply to an existing production DB without a migration run. | Medium (deployment) |
| 5 | `top_n` upper bound | Capped at 50 server-side. No client-side enforcement; UI only offers 5/10/20/50 but the contract allows any 1–50. | Low |
| 6 | Empty state data | All insight sections show "no data" copy when data is genuinely empty. No distinction between "team has zero activity ever" vs "no activity in this window". | Low |
| 7 | No E2E tests | All tests are unit/integration (Vitest + FastAPI `TestClient`). No Playwright/Cypress coverage for the full browser flow. | Medium |
| 8 | Uncommitted state | Pass 5 changes are not yet committed or tagged. The checkpoint is not currently reproducible from a git ref. | High (release process) |

---

## 4. Smoke Test Checklist

Run these against a locally running stack (`uvicorn` + `next dev`) or a staging deployment.

### 4a. Setup

```bash
# Backend — from apps/api/
source .venv/bin/activate
uvicorn src.main:app --reload --port 8000

# Web — from apps/web/
pnpm dev   # default port 3000
```

Register a test user and a second non-member user once before running the flow tests:

```bash
# Register owner
curl -s -X POST http://localhost:8000/v0/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@smoke.test","password":"smoketest123"}' | jq .

# Login owner — capture token
TOKEN=$(curl -s -X POST http://localhost:8000/v0/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@smoke.test","password":"smoketest123"}' | jq -r .access_token)

# Register non-member
curl -s -X POST http://localhost:8000/v0/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"outsider@smoke.test","password":"smoketest123"}' | jq .

OUTSIDER_TOKEN=$(curl -s -X POST http://localhost:8000/v0/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"outsider@smoke.test","password":"smoketest123"}' | jq -r .access_token)
```

### 4b. API Health

```bash
# [ ] Returns {"status": "ok"}
curl -s http://localhost:8000/health | jq .
```

Expected: `{"status": "ok"}`

### 4c. Team Create + Analytics Happy Path

```bash
# [ ] Create team — 201
TEAM_ID=$(curl -s -X POST http://localhost:8000/v0/teams \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Test Team"}' | jq -r .team_id)

echo "Team ID: $TEAM_ID"

# [ ] Analytics summary — 200, shape correct
curl -s "http://localhost:8000/v0/teams/$TEAM_ID/analytics/summary" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Expected: results_last_7d, results_last_30d, results_last_90d, severity_breakdown,
#           mode_breakdown, language_breakdown, active_members_last_30d

# [ ] Analytics summary with days param — 200
curl -s "http://localhost:8000/v0/teams/$TEAM_ID/analytics/summary?days=7" \
  -H "Authorization: Bearer $TOKEN" | jq .

# [ ] Insights — 200, shape correct
curl -s "http://localhost:8000/v0/teams/$TEAM_ID/analytics/insights" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Expected: daily_results_last_14d (array), top_bug_categories_last_30d,
#           top_signatures_last_30d, member_activity_last_30d

# [ ] Insights with params — 200
curl -s "http://localhost:8000/v0/teams/$TEAM_ID/analytics/insights?days=7&top_n=5" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### 4d. Non-Member 403 Path

```bash
# [ ] Summary — non-member gets 403 (not 404, not 422)
curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:8000/v0/teams/$TEAM_ID/analytics/summary" \
  -H "Authorization: Bearer $OUTSIDER_TOKEN"
# Expected: 403

# [ ] Non-member with invalid days still gets 403 (not 422)
curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:8000/v0/teams/$TEAM_ID/analytics/summary?days=999" \
  -H "Authorization: Bearer $OUTSIDER_TOKEN"
# Expected: 403

# [ ] Insights — non-member gets 403
curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:8000/v0/teams/$TEAM_ID/analytics/insights" \
  -H "Authorization: Bearer $OUTSIDER_TOKEN"
# Expected: 403
```

### 4e. Invalid Params 422 Path (member only)

```bash
# [ ] Invalid days value — 422
curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:8000/v0/teams/$TEAM_ID/analytics/summary?days=999" \
  -H "Authorization: Bearer $TOKEN"
# Expected: 422

# [ ] Invalid top_n (>50) — 422
curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:8000/v0/teams/$TEAM_ID/analytics/insights?top_n=100" \
  -H "Authorization: Bearer $TOKEN"
# Expected: 422

# [ ] Invalid top_n (0) — 422
curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:8000/v0/teams/$TEAM_ID/analytics/insights?top_n=0" \
  -H "Authorization: Bearer $TOKEN"
# Expected: 422

# [ ] CreateTeam empty name — 422
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/v0/teams \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"   "}' 
# Expected: 422
```

### 4f. Analytics Event (Observability)

```bash
# [ ] team_insights_selector_changed accepted — 201
curl -s -X POST http://localhost:8000/v0/analytics/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event_type":"team_insights_selector_changed","properties":{"days":7,"top_n":5}}' | jq .
# Expected: {"event_id": "<uuid>"}

# [ ] Unknown extra property still rejected — 422
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/v0/analytics/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event_type":"team_insights_selector_changed","properties":{"days":7,"unknown":"x"}}'
# Expected: 422
```

### 4g. Web Selector Interaction (manual)

1. Open `http://localhost:3000` and log in (or inject token in localStorage: `access_token`, `refresh_token`).
2. Select or create a team in the sidebar team selector.
3. Navigate to the Dashboard.
4. **[ ]** The analytics summary panel shows a skeleton while loading, then renders cards.
5. **[ ]** The insights panel shows a skeleton while loading, then renders trend bars and ranked lists.
6. **[ ]** Click `7d` pill — insights panel re-fetches and re-renders (skeleton flash, then data).
7. **[ ]** Click `50` pill — insights panel re-fetches and re-renders.
8. **[ ]** Open browser DevTools → Network → filter `analytics/events` — confirm a POST fires on each pill click with `event_type: "team_insights_selector_changed"` and correct `days`/`top_n` payload. Confirm no POST fires on initial page load.
9. **[ ]** Disconnect API (stop uvicorn). Reload dashboard. Both panels show error cards with "Try again" button. Clicking "Try again" re-attempts the fetch.
10. **[ ]** Reconnect API. Click "Try again". Data loads successfully.

### 4h. End-to-End Team Scope Dashboard Flow

```
1. Register a new user (owner)
2. Login → capture token
3. POST /v0/teams  →  capture team_id
4. POST /v0/results (with team_id, valid code_hash, severity)  ×3  — inject some data
5. GET /v0/teams/{team_id}/analytics/summary  →  confirm counts > 0
6. GET /v0/teams/{team_id}/analytics/insights  →  confirm daily_results_last_14d non-trivial
7. GET /v0/teams/{team_id}/analytics/insights?days=7&top_n=5  →  confirm response honours params
8. POST /v0/analytics/events  →  fire team_insights_selector_changed  →  201
9. Register outsider  →  confirm 403 on all /analytics/* endpoints for that team
```

Step 4 example payload:
```bash
curl -s -X POST http://localhost:8000/v0/results \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"team_id\": \"$TEAM_ID\",
    \"code_hash\": \"$(printf '%064d' 0 | tr '0' 'a')\",
    \"severity\": \"high\",
    \"mode\": \"quick\",
    \"language\": \"python\",
    \"findings\": []
  }" | jq .
```

---

## 5. Rollback Plan

The web MVP is built across 5 clearly scoped slices. Each can be independently reverted in reverse order.

### 5a. Rollback Groups

| Group | Commits / Description | Reverts safely alone? |
|---|---|---|
| **G5** | Uncommitted pass-5 changes (polish, hardening, observability) | Yes — no DB migration, no new API contract |
| **G4** | PR #8 `fdfb0e3` + PR #7 `7c589a0` — Analytics v3 controls + perf | Yes — removes `days`/`top_n` params (additive only) |
| **G3** | PR #6 `9dec492` — Team insights endpoint + InsightsPanel | Yes — remove endpoint and component |
| **G2** | PR #5 `6803b02` — Team analytics summary + AnalyticsPanel | Yes — remove endpoint and component |
| **G1** | PR #4 `137f1eb` + `aa73046` + `def5590` + `660e405` — Teams scaffold | Requires G2+G3+G4+G5 reverted first |

**Dependency order:** Revert G5 → G4 → G3 → G2 → G1. Do not revert G1 while G2–G5 remain; the teams router depends on the `Team`/`TeamMember` models from G1.

### 5b. Backend Contract Considerations

- `GET /analytics/summary` and `GET /analytics/insights` are additive endpoints. Reverting G2/G3 removes them cleanly; no other endpoint depends on them.
- `POST /analytics/events` pre-dates this checkpoint. G5 only adds a new allowed event type and two new nullable fields. Reverting G5 is safe; old extension clients sending pre-existing event types continue to work.
- The composite indexes in `src/db/models.py` (G4) are performance-only. Reverting them does not break correctness, only query speed.
- `CreateTeamRequest` name validation (G5) and `code_hash` hex validation (G5) are purely additive constraints. Reverting them re-opens the lax behaviour; no client breaks.

### 5c. Rollback Commands Template

> **Do not run these commands without confirming which group to revert.**
> All commands are templates — verify commit hashes against `git log` before use.

```bash
# ── Verify current state ──────────────────────────────────────────────────────
git log --oneline -10

# ── G5: Discard uncommitted pass-5 changes (safe; no commits yet) ────────────
git checkout -- apps/api/src/analytics/router.py
git checkout -- apps/api/src/results/router.py
git checkout -- apps/api/src/teams/router.py
git checkout -- apps/api/tests/test_analytics.py
git checkout -- apps/api/tests/test_teams.py
git checkout -- apps/web/src/components/teams/TeamAnalyticsPanel.tsx
git checkout -- apps/web/src/components/teams/TeamInsightsPanel.tsx
git checkout -- apps/web/src/test/team-analytics.test.tsx
git checkout -- apps/web/src/test/team-insights-v3.test.tsx
git checkout -- apps/web/src/test/team-insights.test.tsx
git checkout -- docs/RELEASE_CHECKLIST.md
git checkout -- PHASE_0_PLAN.md
git rm --cached apps/web/src/lib/api/analytics.ts
rm apps/web/src/lib/api/analytics.ts

# ── G4: Revert PR #8 and PR #7 (after G5 is reverted) ───────────────────────
# git revert fdfb0e3 --no-edit   # Analytics v3 query controls
# git revert 7c589a0 --no-edit   # Perf: SQL optimization, responsive layout
# Then run: cd apps/api && alembic downgrade <rev_before_indexes>

# ── G3: Revert PR #6 (after G4 is reverted) ──────────────────────────────────
# git revert 9dec492 --no-edit   # Team insights endpoint + InsightsPanel

# ── G2: Revert PR #5 (after G3 is reverted) ──────────────────────────────────
# git revert 6803b02 --no-edit   # Team analytics summary + AnalyticsPanel

# ── G1: Revert PR #4 commits (after G2 is reverted) — order matters ──────────
# git revert 660e405 --no-edit   # TeamResponse contract + team-scoped result writes
# git revert def5590 --no-edit   # Web teams API, workspace context, sidebar
# git revert aa73046 --no-edit   # API: filter results by team_id
# git revert 137f1eb --no-edit   # API: TeamMember model and teams CRUD

# ── After any API revert: re-run migrations ───────────────────────────────────
# cd apps/api && alembic upgrade head

# ── Validate after rollback ───────────────────────────────────────────────────
# cd apps/api && pytest -q
# cd apps/web && pnpm test
```

### 5d. Partial Rollback: G5 Only (Most Likely Scenario)

If only the polish/hardening/observability changes need to be dropped:

```bash
# Restore all G5 files from HEAD (last merge commit = 2eafead)
git checkout 2eafead -- \
  apps/api/src/analytics/router.py \
  apps/api/src/results/router.py \
  apps/api/src/teams/router.py \
  apps/web/src/components/teams/TeamAnalyticsPanel.tsx \
  apps/web/src/components/teams/TeamInsightsPanel.tsx

# Remove new analytics helper
rm apps/web/src/lib/api/analytics.ts
```

No DB migration required for G5 rollback.

---

## 6. Verification

Run targeted suites before and after any release or rollback.

### Backend targeted

```bash
cd apps/api && python -m pytest tests/test_analytics.py tests/test_teams.py -v
```

### Web targeted

```bash
cd apps/web && npx vitest run src/test/team-insights-v3.test.tsx src/test/team-analytics.test.tsx
```

### Full suites

```bash
# Backend (all)
cd apps/api && python -m pytest -q

# Web (all)
cd apps/web && npx vitest run
```

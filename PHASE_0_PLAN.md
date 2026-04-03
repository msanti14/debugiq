# DebugIQ — Phase 0 Engineering Plan
**Version 1.0 · April 2026 · Solo Founder Edition**

---

## Audit: Current State

```
debugiq/
└── DebugIQ_Completo/
    ├── DebugIQ_PRD.docx
    ├── DebugIQ_Arquitectura_Tecnica.docx
    ├── DebugIQ_Diagrama_Flujo.html
    └── mnt/user-data/outputs/
        └── DebugIQ_Modelo_de_Negocio.docx
```

**Verdict:** Documentation only. Zero code. Zero infrastructure. Phase 0 starts from scratch.

---

## Recommended Monorepo Structure

```
debugiq/
├── apps/
│   ├── api/                          # FastAPI backend (Railway)
│   │   ├── src/
│   │   │   ├── auth/                 # JWT, register, login, refresh
│   │   │   ├── users/                # Profile, account management
│   │   │   ├── teams/                # Team creation, membership, roles
│   │   │   ├── results/              # Persist structured analysis results
│   │   │   ├── analytics/            # Usage events, aggregations
│   │   │   ├── db/
│   │   │   │   ├── models.py         # SQLAlchemy models
│   │   │   │   └── migrations/       # Alembic migrations
│   │   │   └── core/
│   │   │       ├── config.py         # Settings from env vars only
│   │   │       ├── security.py       # Password hashing, JWT utils
│   │   │       └── middleware.py     # Rate limiting, CORS
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   └── requirements.txt
│   │
│   └── vscode-extension/             # VS Code Extension (TypeScript)
│       ├── src/
│       │   ├── extension.ts          # Activation entry point
│       │   ├── auth/
│       │   │   ├── AuthService.ts    # Register/login/token refresh
│       │   │   └── SecureStorage.ts  # VS Code SecretStorage wrapper
│       │   ├── keychain/
│       │   │   └── KeychainService.ts # OS keychain via vscode.SecretStorage
│       │   ├── analyzer/
│       │   │   ├── QuickAnalyzer.ts  # Orchestrates LLM call + parsing
│       │   │   ├── LearnAnalyzer.ts  # Learn mode orchestration
│       │   │   └── ModelRouter.ts    # Claude / GPT-4o selection logic
│       │   ├── providers/
│       │   │   ├── DiagnosticsProvider.ts
│       │   │   └── SidebarProvider.ts
│       │   ├── demo/
│       │   │   ├── DemoMode.ts       # Feature flag + fixture loader
│       │   │   └── fixtures/         # Static demo results (JSON)
│       │   ├── api/
│       │   │   └── BackendClient.ts  # HTTP client to FastAPI (auth, save results)
│       │   └── types/
│       │       └── index.ts          # Shared type aliases for extension
│       ├── tests/
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── shared-types/                 # Published types shared by API + extension
│       ├── src/
│       │   ├── api.ts                # Request/response interfaces
│       │   └── domain.ts             # AnalysisResult, Finding, Severity, Mode
│       └── package.json
│
├── infra/
│   ├── railway.toml                  # Railway deployment config
│   └── db/
│       └── seed.sql                  # Dev seed data (no PII)
│
├── docs/
│   ├── decisions/                    # ADRs (Architecture Decision Records)
│   │   └── 001-llm-in-extension.md
│   └── original/                     # Move existing DOCX files here
│
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint + test on every PR
│       └── deploy-api.yml            # Deploy to Railway on merge to main
│
├── docker-compose.yml                # Local dev: PostgreSQL only
├── .env.example                      # Template — never real secrets
├── .gitignore
├── pnpm-workspace.yaml
└── README.md
```

**Key architectural decisions encoded in the structure:**
- `keychain/` and `analyzer/` live exclusively in the extension — LLM calls never touch the backend
- `BackendClient.ts` only calls auth/results/analytics endpoints — it never proxies LLM requests
- `demo/fixtures/` are static JSON, zero API dependency
- `packages/shared-types/` enforces a single source of truth for API contracts

---

## Phase 0 Checklist

> **Phase 0 goal:** Deployable skeleton with working auth, DB on Railway, extension that connects to backend, and Demo Mode — before any AI analysis feature.

### Infrastructure

- [x] **INF-01** Initialize git repo with `pnpm-workspace.yaml`, `.gitignore`, `.env.example`
  - AC: `git init && pnpm install` completes cleanly; no secrets committed
- [x] **INF-02** PostgreSQL provisioned on Railway, `DATABASE_URL` in Railway environment
  - AC: `psql $DATABASE_URL -c "\dt"` connects successfully from CI
- [x] **INF-03** Railway service created for `apps/api`, deploy pipeline wired
  - AC: Push to `main` triggers Railway deploy; `/health` returns `200` from public URL
- [x] **INF-04** `docker-compose.yml` runs local PostgreSQL for dev
  - AC: `docker compose up -d` starts Postgres; API connects without Railway URL

### Backend (FastAPI)

- [x] **API-01** Project scaffold: FastAPI, SQLAlchemy, Alembic, Pydantic v2, pytest
  - AC: `uvicorn src.main:app --reload` starts; `GET /health` returns `{"status":"ok","db":"connected"}`
- [x] **API-02** Alembic migration: create all Phase 0 tables (see schema below)
  - AC: `alembic upgrade head` runs idempotently; all tables exist in Railway DB
- [x] **API-03** Auth endpoints: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
  - AC: Register creates user; login returns `access_token` + `refresh_token`; refresh rotates tokens; logout revokes refresh token; all validated with pytest
- [x] **API-04** User profile: `GET /users/me`, `PATCH /users/me`
  - AC: Returns current user fields; PATCH updates `display_name` only; email not patchable
- [x] **API-05** Save result: `POST /results`, `GET /results/{id}`, `GET /results` (paginated)
  - AC: Stores structured findings; code content is never accepted in request body (schema enforces this)
- [x] **API-06** Rate limiting: 60 req/min per user on `/results`, 10 req/min on `/auth/login`
  - AC: 11th login attempt in 1 min returns `429`
- [x] **API-07** CORS: only accept requests from `vscode-webview://*` and `http://localhost:*`
  - AC: Request from random origin returns `403`

### VS Code Extension

- [x] **EXT-01** Extension scaffold: `yo code` TypeScript template, ESLint, Prettier, vitest
  - AC: Extension activates in VS Code; no errors in Output panel
- [x] **EXT-02** Demo Mode: command `debugiq.runDemo` loads fixture results and renders in sidebar
  - AC: Demo works with zero network calls; verified by mocking `fetch` in tests
- [x] **EXT-03** `KeychainService.ts`: store/retrieve/delete API keys via `vscode.SecretStorage`
  - AC: Key survives VS Code restart; key is NOT in `globalState` or any readable storage; unit test confirms storage target
- [x] **EXT-04** `AuthService.ts`: register, login, token refresh; store JWT in `SecretStorage`
  - AC: Token stored in SecretStorage, never in `localStorage` or extension settings
- [x] **EXT-05** `BackendClient.ts`: typed HTTP client with auth header injection and 401 auto-refresh
  - AC: Client retries with refreshed token on 401; throws after second 401
- [x] **EXT-06** `ModelRouter.ts` stub: accepts `{mode, language}`, returns model name — no LLM calls yet
  - AC: Unit tests cover Quick/Learn routing for Python and TypeScript

### Shared Types

- [x] **TYP-01** `packages/shared-types` defines: `AnalysisResult`, `Finding`, `Severity`, `AnalysisMode`, all auth request/response shapes
  - AC: Both `apps/api` (via JSON schema) and `vscode-extension` import from this package without circular deps

### CI/CD

- [x] **CI-01** GitHub Actions: lint + test on every PR (`pnpm lint && pnpm test`)
  - AC: Intentional type error in PR causes CI to fail
- [x] **CI-02** GitHub Actions: deploy `apps/api` to Railway on merge to `main`
  - AC: Merge to main triggers deploy; health endpoint live within 3 minutes

---

## API Contracts v0

> Base URL: `$API_BASE_URL/v0` — set as environment variable in extension and CI; Railway-generated URL used in Phase 0 until domain is confirmed
> All requests: `Content-Type: application/json`
> Auth: `Authorization: Bearer <access_token>` (except auth endpoints)

### Health

```
GET /health
→ 200 { "status": "ok", "db": "connected", "version": "0.1.0" }
→ 503 { "status": "degraded", "db": "error" }
```

### Auth

```
POST /auth/register
Body:    { "email": string, "password": string, "display_name"?: string }
→ 201   { "user_id": uuid, "email": string }
→ 409   { "detail": "email_already_registered" }
→ 422   validation error

POST /auth/login
Body:    { "email": string, "password": string }
→ 200   { "access_token": string, "refresh_token": string,
           "token_type": "bearer", "expires_in": 900 }
→ 401   { "detail": "invalid_credentials" }

POST /auth/refresh
Body:    { "refresh_token": string }
→ 200   { "access_token": string, "refresh_token": string, "expires_in": 900 }
→ 401   { "detail": "refresh_token_invalid_or_expired" }
  Note:  refresh token rotates on every call (old token immediately revoked)

POST /auth/logout
Auth:    required
Body:    { "refresh_token": string }
→ 204   (no body)
```

### User Profile

```
GET /users/me
Auth:    required
→ 200   { "user_id": uuid, "email": string, "display_name": string,
           "tier": "free"|"starter"|"team"|"studio",
           "created_at": iso8601 }

PATCH /users/me
Auth:    required
Body:    { "display_name"?: string }   ← email NOT patchable here
→ 200   updated user object
→ 422   validation error
```

### Analysis Results

```
POST /results
Auth:    required
Body:    {
  "language":      "python"|"typescript",
  "mode":          "quick"|"learn",
  "code_hash":     string,           // SHA-256 of analyzed snippet — NO raw code
  "findings":      Finding[],
  "model_used":    string,           // "claude-sonnet-4"|"gpt-4o"|"demo"
  "duration_ms":   number,
  "demo_mode":     boolean
}
→ 201   { "result_id": uuid, "created_at": iso8601 }
→ 401   unauthorized
→ 422   validation error

GET /results/{result_id}
Auth:    required
→ 200   full result object (findings included)
→ 404   not found or not owned by caller

GET /results?page=1&page_size=20&language=python&mode=quick
Auth:    required
→ 200   { "items": Result[], "total": number, "page": number, "page_size": number }
```

### Finding Schema (shared type)

```typescript
interface Finding {
  id:           string          // UUID, generated client-side
  category:     BugCategory
  severity:     "critical"|"high"|"medium"|"low"|"info"
  title:        string          // max 80 chars
  description:  string          // max 500 chars
  line_start:   number
  line_end:     number
  fix_hint?:    string          // Quick mode: one-liner fix
  explanation?: string          // Learn mode: educational explanation
}

type BugCategory =
  | "sql_injection"
  | "null_unhandled"
  | "hardcoded_secret"
  | "bare_exception"
  | "client_side_auth"
  | "cors_misconfigured"
  | "xss"
  | "other"
```

---

## Database Schema v0

> PostgreSQL on Railway. All tables use `uuid` PKs. Timestamps in UTC.
> No raw code stored anywhere in the schema — only `code_hash`.

```sql
-- Users
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  display_name    TEXT,
  tier            TEXT NOT NULL DEFAULT 'free',  -- free|starter|team|studio
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Refresh tokens (rotated on every use)
CREATE TABLE refresh_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL UNIQUE,  -- bcrypt hash of the token
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at      TIMESTAMPTZ            -- NULL = active
);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- Teams (Phase 0 scaffold — not user-facing until Phase 1)
CREATE TABLE teams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  owner_id        UUID NOT NULL REFERENCES users(id),
  tier            TEXT NOT NULL DEFAULT 'free',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Team membership
CREATE TABLE team_members (
  team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'member',  -- owner|admin|member
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

-- Analysis results (persisted structured output — never raw code)
CREATE TABLE analysis_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  team_id         UUID REFERENCES teams(id),       -- NULL for solo users
  language        TEXT NOT NULL,                   -- python|typescript
  mode            TEXT NOT NULL,                   -- quick|learn
  code_hash       TEXT NOT NULL,                   -- SHA-256, for dedup/cache
  findings_count  INTEGER NOT NULL DEFAULT 0,
  findings        JSONB NOT NULL DEFAULT '[]',     -- Finding[] array
  model_used      TEXT NOT NULL,                   -- claude-sonnet-4|gpt-4o|demo
  duration_ms     INTEGER,
  demo_mode       BOOLEAN NOT NULL DEFAULT FALSE,
  analyzed_at     TIMESTAMPTZ NOT NULL,            -- when analysis ran (client time)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_results_user_id ON analysis_results(user_id);
CREATE INDEX idx_results_code_hash ON analysis_results(code_hash);
CREATE INDEX idx_results_created_at ON analysis_results(created_at);

-- Analytics events (lightweight, append-only)
CREATE TABLE analytics_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),       -- NULL for anonymous demo events
  event_type      TEXT NOT NULL,                   -- extension_activated|analysis_run|demo_used|etc
  properties      JSONB DEFAULT '{}',
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_analytics_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_event_type ON analytics_events(event_type);
```

**Retention policy (enforced by scheduled job):**
- `analysis_results`: hard delete after 90 days (configurable per tier in Phase 2)
- `analytics_events`: anonymize `user_id` after 30 days, delete after 1 year
- `refresh_tokens`: delete expired/revoked tokens older than 7 days

---

## Security and Privacy Rules

### API Key Handling (Non-Negotiable)

| Rule | Implementation |
|------|---------------|
| User LLM keys (Claude, OpenAI) NEVER leave the local machine | Stored exclusively via `vscode.SecretStorage` (OS keychain: Keychain on macOS, Credential Manager on Windows, libsecret on Linux) |
| Keys never in `globalState`, `workspaceState`, settings.json, or any file | `KeychainService.ts` is the only access point; ESLint rule bans direct `globalState` writes for key-named vars |
| Keys never logged | `KeychainService.ts` returns `Promise<string>` — callers receive the value, never log it; CI lint rule flags any `console.log` containing "key" near SecretStorage calls |
| Backend never accepts or proxies LLM API keys | No endpoint in API contracts accepts an API key field; OpenAPI schema enforced |
| Demo Mode requires zero keys | `DemoMode.ts` returns fixture data synchronously; no network calls |

### JWT Security

| Rule | Value |
|------|-------|
| `access_token` TTL | 15 minutes |
| `refresh_token` TTL | 30 days |
| Refresh token rotation | Every use rotates token; old token revoked immediately |
| Storage in extension | `vscode.SecretStorage` only |
| Token binding | `refresh_token` row tied to `user_id`; cannot be used cross-user |
| Logout | Revokes refresh token server-side; access token expires naturally (short TTL) |

### Data Minimization

| What | Rule |
|------|------|
| Raw code | Never sent to backend, never stored. SHA-256 hash only. |
| Findings | Stored as structured JSONB (title, line numbers, category) — not code snippets |
| Email | Only PII collected at signup. No phone, no real name required. |
| IP addresses | Not persisted in DB. Railway access logs retained per Railway policy. |
| Analytics | `user_id` anonymized after 30 days in `analytics_events` |

### Backend Hardening

```
- Passwords: bcrypt with cost factor 12
- All env vars from Railway secrets; .env.example has no real values
- SQL: SQLAlchemy ORM only; no raw string interpolation
- Input: Pydantic v2 strict validation on all request bodies
- Headers: HSTS, X-Content-Type-Options, X-Frame-Options via middleware
- Rate limits: 60 req/min (results), 10 req/min (login) per user_id
- CORS: vscode-webview://* and localhost only
- No admin endpoints without separate auth layer (Phase 1+)
```

### Secrets Checklist (before first commit)

- [ ] `.env` in `.gitignore`
- [ ] `DATABASE_URL` in Railway only, never in code
- [ ] `JWT_SECRET` generated with `openssl rand -hex 32`, stored in Railway
- [ ] No API keys in any test fixtures (use `"demo"` model in tests)
- [ ] `git log --all --full-history -- "*.env"` returns empty on first push

---

## Week-1 Execution Plan

> Total available: ~5 focused work days.
> Definition of "done" for each day: committed, pushed, CI green.

### Day 1 — Foundation (Mon)
**Goal:** Repo exists, tooling configured, Railway connected.

- [ ] Create `debugiq` repo (private), initialize with `pnpm-workspace.yaml`
- [ ] Create folder structure per monorepo layout above
- [ ] Configure `.gitignore`, `.env.example`, root `package.json` with lint/format scripts
- [ ] Scaffold `apps/api`: `pyproject.toml` (FastAPI, SQLAlchemy, Alembic, pytest, PyJWT>=2.8.0, passlib[bcrypt], psycopg2-binary)
- [ ] Scaffold `apps/vscode-extension`: `yo code` TypeScript, vitest, ESLint
- [ ] `docker-compose.yml`: PostgreSQL 16 for local dev
- [ ] Provision Railway PostgreSQL; save `DATABASE_URL` as Railway env var

**Deliverable:** `pnpm install` + `docker compose up -d` + API `uvicorn` starts with `/health → 200`

---

### Day 2 — Database + Auth Backend (Tue)
**Goal:** Auth endpoints live on Railway.

- [ ] Define SQLAlchemy models for all Phase 0 tables
- [ ] Write and run Alembic initial migration
- [ ] Implement `POST /auth/register` + `POST /auth/login`
- [ ] Implement JWT creation (`PyJWT>=2.8.0`) + bcrypt hashing (`passlib[bcrypt]`)
- [ ] Implement `POST /auth/refresh` with token rotation
- [ ] Implement `POST /auth/logout` (revoke refresh token)
- [ ] Write pytest tests for all auth endpoints (happy + sad paths)
- [ ] Deploy to Railway; verify via `curl $API_BASE_URL/v0/health` (use Railway-generated URL)

**Deliverable:** All auth endpoints passing tests; Railway deploy green.

---

### Day 3 — Profile + Results Backend (Wed)
**Goal:** All Phase 0 API endpoints implemented and tested.

- [ ] Implement `GET /users/me` + `PATCH /users/me`
- [ ] Implement `POST /results` (validate no raw code field, store findings JSONB)
- [ ] Implement `GET /results/{id}` + `GET /results` (pagination)
- [ ] Add rate limiting middleware (slowapi)
- [ ] Add CORS middleware (restricted origins)
- [ ] Write `packages/shared-types`: `Finding`, `AnalysisResult`, `Severity`, auth shapes
- [ ] Write pytest tests for results endpoints
- [ ] GitHub Actions `ci.yml`: lint + pytest on PR

**Deliverable:** Full API surface from contracts above is live and tested.

---

### Day 4 — VS Code Extension Core (Thu)
**Goal:** Extension activates, Demo Mode works, auth flow connects to backend.

- [ ] `extension.ts` activation with `debugiq.runDemo` and `debugiq.login` commands
- [ ] `KeychainService.ts`: wrap `vscode.SecretStorage`; unit test confirms write/read/delete
- [ ] `AuthService.ts`: register/login/refresh against Railway backend
- [ ] `BackendClient.ts`: typed fetch wrapper with 401 auto-refresh
- [ ] `DemoMode.ts`: load 3 fixture results (Python quick, TS quick, Python learn)
- [ ] `SidebarProvider.ts`: render demo results in webview (static HTML, no styling yet)
- [ ] `ModelRouter.ts` stub: returns model name from `{mode, language}` config
- [ ] Vitest unit tests for KeychainService, AuthService, DemoMode

**Deliverable:** `F5` in VS Code runs extension; demo command shows mock results; auth tokens stored in SecretStorage.

---

### Day 5 — Hardening + Go/No-Go Review (Fri)
**Goal:** Security rules verified, CI fully green, Phase 0 gate assessed.

- [x] Verify no secrets in git history (`git log --all --full-history -- "*.env"`)
- [x] Verify `analysis_results` schema rejects any request with code content field
- [x] Add `deploy-api.yml` GitHub Action (Railway deploy on `main` merge)
- [x] Run full test suite locally (`pnpm test` across all packages)
- [x] Document Railway env vars in `infra/railway.toml` (var names only, no values)
- [x] Move existing DOCX docs to `docs/original/`
- [x] Write ADR-001: "LLM calls happen in extension, not backend"
  - Include sync protocol note: any change to a type in `packages/shared-types/src/domain.ts` **must** include a matching update to the corresponding Pydantic model in `apps/api` in the **same commit**. No automated enforcement in Phase 0 — discipline enforced via PR checklist item: *"Did you update both the shared-types domain and the Pydantic model?"*
- [x] Go/No-Go self-review against gate below

**Deliverable:** All CI green, Railway deployed, Go/No-Go checklist filled.

**Status (Apr 2026):** Completed. MVP release candidate reached GO and shipped with post-release hook compatibility fix.

---

## Go/No-Go Gate

> All **MUST** items required to enter Phase 1. **SHOULD** items are tracked debt.

### MUST (blocking)

- [x] `GET /health` returns `200` from Railway public URL
- [x] Full auth cycle (register → login → refresh → logout) passes automated tests
- [x] `POST /results` schema rejects any body containing a field with raw code
- [x] Extension activates and Demo Mode returns results with zero network calls (verified by test mock)
- [x] LLM API keys stored only in `vscode.SecretStorage`; no key field exists in any backend endpoint schema
- [x] No secrets or `.env` files in git history
- [x] Railway PostgreSQL is the only database; no other persistence layer exists
- [x] CI pipeline (lint + test) passes on `main` branch

### SHOULD (non-blocking but logged as debt)

- [x] `GET /results` pagination tested with >20 items
- [x] Refresh token rotation tested under concurrent requests
- [ ] Extension tested on Windows (SecretStorage backend differs)
- [x] Railway auto-deploy tested end-to-end (not just manually triggered)

### Assumptions (must be true for plan to hold)

1. Railway free/hobby tier is sufficient for Phase 0 load (<50 users)
2. `vscode.SecretStorage` is available on all target platforms (VS Code 1.53+)
3. Solo founder can sustain 5 focused engineering days/week
4. No external investor demo before Phase 1 (Phase 0 has no visible AI analysis)
5. Domain `debugiq.app` is available or an alternative is chosen before Day 3

### Blockers (stop work if any of these are true)

| Blocker | Mitigation |
|---------|-----------|
| Railway PostgreSQL unavailable or migration fails | Switch to Supabase free tier (same PostgreSQL, different host) |
| `vscode.SecretStorage` unavailable in target environment | Fall back to in-memory for session only; prompt user on restart |
| Domain not available | Use Railway-generated URL for Phase 0; defer custom domain to Phase 1 |

### Phase 1 Unlock Criteria (Historical)

Phase 1 (Quick Debug Mode with real LLM analysis) was unlocked after meeting gate criteria.

- [x] All MUST items above are checked
- [x] At least one real user (not founder) has completed the auth flow end-to-end
- [x] Demo Mode has been shown to at least 2 people and received qualitative feedback
- [x] `POST /results` successfully stored demo-mode results in Railway DB

### Release Closure Notes (Apr 2026)

- Release candidate status: GO final.
- Extension and backend smoke tests passed in a clean VS Code environment.
- Hook behavior validated as warn-only: warnings are shown and commits are never blocked.
- Lesson learned: hook scripts using `#!/bin/sh` must avoid bash-only expansions such as `${VAR:0:16}`.
- Applied fix: use POSIX `printf` truncation (`%.16s`) for signature preview in pre-commit warnings.

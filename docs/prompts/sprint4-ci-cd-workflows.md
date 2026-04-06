# Sprint 4 — CI/CD Workflows (Index)

Split into two subprompts to keep each session focused:

| Subprompt | File | Scope |
|---|---|---|
| A | `sprint4-ci-cd-subprompt-A.md` | Edit existing workflows: add web CI job, fix API deploy gate |
| B | `sprint4-ci-cd-subprompt-B.md` | Create new files: deploy-web.yml, DEPLOY_SETUP.md |

Run A first, commit, then run B.

---

# Full reference (original)

## Context

You are working in the monorepo at `/home/estudiante/debugiq`.

**Current CI/CD state:**

- `.github/workflows/ci.yml` — runs on push/PR to `main`. Has 3 jobs:
  - `lint-and-test-api` (Python, pytest, postgres service)
  - `lint-and-test-extension` (Node, pnpm, vitest)
  - `lint-shared-types` (typecheck only)
  - **Missing**: no job for `apps/web`
- `.github/workflows/deploy-api.yml` — deploys API to Railway on push to `main` (paths: `apps/api/**`).
  - Has `needs: []` — currently NOT gated on CI passing.
- No `deploy-web.yml` exists yet.
- Target deploy: **Vercel** (web), **Railway** (API).
- `apps/web/vercel.json` exists with `{"framework": "nextjs"}`.

**Verified baselines:**
- `pnpm build` (web) → clean, 8 routes
- `pnpm test --run` (web) → 58 tests passing
- `pnpm typecheck` (web) → clean
- `pnpm lint` (web) → clean

---

## Objective

Complete all CI/CD automation so that:
1. Every push to `main` runs the full test suite (including web).
2. API deploys to Railway **only after** all CI jobs pass.
3. Web deploys to Vercel **only after** all CI jobs pass.
4. A manual setup document exists so a human can configure the required secrets.

---

## Tasks

### Task 1 — Add `lint-and-test-web` job to `ci.yml`

Edit `.github/workflows/ci.yml` and add a new job after `lint-shared-types`:

```yaml
  lint-and-test-web:
    name: Web — lint + typecheck + test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/web

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 10

      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        working-directory: .

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm typecheck

      - name: Tests
        run: pnpm test --run
```

Do NOT add a postgres service — web tests are pure unit tests with no DB dependency.
Do NOT add an E2E step — Playwright tests require a running server and are not run in CI at this stage.

### Task 2 — Fix `deploy-api.yml` to gate on CI

The `deploy-api.yml` workflow currently has `needs: []`. This means it can deploy even if tests fail.

Replace the existing `deploy-api.yml` with a version that uses `workflow_run` to wait for the CI workflow to complete successfully before deploying.

The corrected `deploy-api.yml` should look like this:

```yaml
name: Deploy API to Railway

on:
  workflow_run:
    workflows: ["CI"]
    branches: ["main"]
    types: [completed]

jobs:
  deploy:
    name: Deploy FastAPI → Railway
    runs-on: ubuntu-latest
    # Only deploy if CI passed AND the triggering push touched the API or this workflow
    if: >
      github.event.workflow_run.conclusion == 'success' &&
      github.event.workflow_run.head_branch == 'main'

    steps:
      - uses: actions/checkout@v4

      - name: Install Railway CLI
        run: npm install -g @railway/cli

      - name: Deploy
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        run: railway up --service debugiq-api --detach
        working-directory: apps/api
```

### Task 3 — Create `deploy-web.yml`

Create `.github/workflows/deploy-web.yml`:

```yaml
name: Deploy Web to Vercel

on:
  workflow_run:
    workflows: ["CI"]
    branches: ["main"]
    types: [completed]

jobs:
  deploy:
    name: Deploy Next.js → Vercel
    runs-on: ubuntu-latest
    if: >
      github.event.workflow_run.conclusion == 'success' &&
      github.event.workflow_run.head_branch == 'main'

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 10

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Vercel CLI
        run: npm install -g vercel

      - name: Pull Vercel project settings
        run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
        working-directory: apps/web

      - name: Build
        run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
        working-directory: apps/web
        env:
          NEXT_PUBLIC_API_URL: ${{ vars.NEXT_PUBLIC_API_URL }}

      - name: Deploy
        run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
        working-directory: apps/web
```

### Task 4 — Create `docs/deploy/DEPLOY_SETUP.md`

Create a setup guide for humans who need to configure the required secrets and connect external services. Use this exact content:

```markdown
# Deployment Setup Guide

## GitHub Secrets Required

Configure these in: GitHub → Settings → Secrets and variables → Actions

| Secret name | Description | How to get it |
|---|---|---|
| `RAILWAY_TOKEN` | Railway API token for API deploys | Railway dashboard → Account → API Tokens |
| `VERCEL_TOKEN` | Vercel API token for web deploys | Vercel dashboard → Settings → Tokens |

## GitHub Variables Required (not secrets)

Configure these in: GitHub → Settings → Secrets and variables → Actions → Variables

| Variable name | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<your-railway-domain>` | Railway service URL, no trailing slash |

## Railway Setup (API)

1. Create a Railway project and add a PostgreSQL plugin.
2. Create a service pointing to this repo, root directory: `apps/api`.
3. Railway sets `DATABASE_URL` automatically from the PostgreSQL plugin.
4. Set these environment variables in the Railway service dashboard:

| Variable | Value |
|---|---|
| `JWT_SECRET` | `openssl rand -hex 32` (generate a unique value) |
| `APP_ENV` | `production` |
| `APP_VERSION` | `0.1.0` |
| `ALLOWED_WEB_ORIGIN` | `https://<your-vercel-domain>` (set after Vercel deploy) |

5. Run the Alembic migration once after first deploy:
   ```bash
   # In Railway's shell or via railway run
   alembic upgrade head
   ```

## Vercel Setup (Web)

1. Create a Vercel project connected to this GitHub repo.
2. Set **Root Directory** to `apps/web` in project settings.
3. Framework preset will be auto-detected as Next.js (via `apps/web/vercel.json`).
4. Set this environment variable in Vercel project settings:

| Variable | Value | Environment |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<your-railway-domain>` | Production |

5. Run `vercel link` locally from `apps/web` to generate `.vercel/project.json`:
   ```bash
   cd apps/web
   vercel link
   ```
   This creates `.vercel/project.json` which the deploy workflow reads automatically.
   Commit `.vercel/project.json` to the repo.

## Workflow Execution Flow

```
push to main
    └── CI workflow runs (lint + test: API, extension, shared-types, web)
            └── on success → deploy-api.yml   (Railway)
            └── on success → deploy-web.yml   (Vercel)
```

Both deploy workflows are skipped if CI fails. Neither deploy runs on PRs.
```

---

## Verification Steps

After making all changes, run:

```bash
# Validate YAML syntax for all workflow files
cd /home/estudiante/debugiq
python3 -c "
import yaml, glob, sys
files = glob.glob('.github/workflows/*.yml')
errors = []
for f in files:
    try:
        yaml.safe_load(open(f))
        print(f'OK: {f}')
    except yaml.YAMLError as e:
        errors.append(f'ERROR in {f}: {e}')
        print(errors[-1])
sys.exit(1 if errors else 0)
"

# Confirm the 4 expected workflow files exist
ls .github/workflows/
```

Expected files: `ci.yml`, `deploy-api.yml`, `deploy-web.yml`

Also confirm the web CI job is present:
```bash
grep -A 3 "lint-and-test-web" .github/workflows/ci.yml
```

---

## Constraints

- Do NOT modify any files in `apps/web/src/`, `apps/api/src/`, or test files.
- Do NOT add npm/pip dependencies.
- Do NOT run any servers or attempt actual deploys.
- Do NOT create `.vercel/project.json` — that requires `vercel link` with a real Vercel account (documented in the setup guide).
- The `docs/deploy/DEPLOY_SETUP.md` is the only new markdown file allowed.
- YAML indentation must be consistent (2 spaces). Validate with the python3 check above.

---

## Expected Deliverables

| File | Action |
|---|---|
| `.github/workflows/ci.yml` | Add `lint-and-test-web` job |
| `.github/workflows/deploy-api.yml` | Replace with `workflow_run` trigger |
| `.github/workflows/deploy-web.yml` | Create |
| `docs/deploy/DEPLOY_SETUP.md` | Create |

**No new tests** — this sprint modifies only CI config and adds documentation.

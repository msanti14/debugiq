# Sprint 4 — Subprompt B: Web Deploy + Ops Docs (create new files)

## Context

You are working in the monorepo at `/home/estudiante/debugiq`.

**Prerequisites (completed in Subprompt A):**
- `.github/workflows/ci.yml` now has a `lint-and-test-web` job.
- `.github/workflows/deploy-api.yml` now uses `workflow_run` trigger.

**This subprompt creates two new files only.**

---

## Tasks

### Task 1 — Create `.github/workflows/deploy-web.yml`

Create this file with the following exact content:

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

### Task 2 — Create `docs/deploy/DEPLOY_SETUP.md`

Create this file with the following exact content:

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
   Commit `.vercel/project.json` to the repo after linking.

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

```bash
cd /home/estudiante/debugiq

# 1. Validate YAML syntax on new workflow
python3 -c "
import yaml, sys
f = '.github/workflows/deploy-web.yml'
try:
    yaml.safe_load(open(f))
    print(f'OK: {f}')
except yaml.YAMLError as e:
    print(f'ERROR: {f} — {e}')
    sys.exit(1)
"

# 2. Confirm all 3 workflow files exist
ls .github/workflows/

# 3. Confirm docs file exists
ls docs/deploy/DEPLOY_SETUP.md
```

Expected:
- `deploy-web.yml` → `OK`
- `ls` shows: `ci.yml`, `deploy-api.yml`, `deploy-web.yml`
- `DEPLOY_SETUP.md` present

---

## Constraints

- Create ONLY `.github/workflows/deploy-web.yml` and `docs/deploy/DEPLOY_SETUP.md`.
- Do NOT modify any file that already exists.
- Do NOT create `.vercel/project.json` — that requires `vercel link` with a real Vercel account (documented in the setup guide).
- Do NOT add any dependencies.

## Deliverables

| File | Action |
|---|---|
| `.github/workflows/deploy-web.yml` | Create |
| `docs/deploy/DEPLOY_SETUP.md` | Create |

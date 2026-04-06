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

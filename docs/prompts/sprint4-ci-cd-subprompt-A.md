# Sprint 4 — Subprompt A: CI Hardening (edit existing workflows)

## Context

You are working in the monorepo at `/home/estudiante/debugiq`.

**Current CI state:**

- `.github/workflows/ci.yml` has 3 jobs: `lint-and-test-api`, `lint-and-test-extension`, `lint-shared-types`.  
  **Missing**: no job for `apps/web`.
- `.github/workflows/deploy-api.yml` exists and deploys the API to Railway.  
  It has `needs: []` — currently NOT gated on CI passing.

**Verified baselines for `apps/web`:**
- `pnpm lint` → clean
- `pnpm typecheck` → clean
- `pnpm test --run` → 58 tests passing (pure unit tests, no DB, no server)

---

## Tasks

### Task 1 — Add `lint-and-test-web` job to `ci.yml`

Open `.github/workflows/ci.yml` and add the following job **after the `lint-shared-types` job**:

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

**Important constraints:**
- Do NOT add a postgres service — web tests are pure Vitest unit tests with no DB dependency.
- Do NOT add an E2E/Playwright step — those require a running server and are not run in CI.
- The job name in YAML must be exactly `lint-and-test-web`.
- Maintain 2-space indentation consistent with the rest of the file.

### Task 2 — Fix `deploy-api.yml` to gate on CI

The current `deploy-api.yml` uses `on: push` and `needs: []`, which allows deploys even when tests fail.

**Replace the entire contents** of `.github/workflows/deploy-api.yml` with:

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

---

## Verification Steps

```bash
cd /home/estudiante/debugiq

# 1. Validate YAML syntax on both files
python3 -c "
import yaml, sys
files = ['.github/workflows/ci.yml', '.github/workflows/deploy-api.yml']
ok = True
for f in files:
    try:
        yaml.safe_load(open(f))
        print(f'OK: {f}')
    except yaml.YAMLError as e:
        print(f'ERROR: {f} — {e}')
        ok = False
sys.exit(0 if ok else 1)
"

# 2. Confirm web job is present
grep -A 2 "lint-and-test-web" .github/workflows/ci.yml

# 3. Confirm deploy-api.yml now uses workflow_run
grep "workflow_run" .github/workflows/deploy-api.yml
```

Expected output:
- Both YAML files → `OK`
- `lint-and-test-web:` line present in `ci.yml`
- `workflow_run:` line present in `deploy-api.yml`

---

## Constraints

- Modify ONLY `.github/workflows/ci.yml` and `.github/workflows/deploy-api.yml`.
- Do NOT touch any files in `apps/`, `packages/`, or `docs/`.
- Do NOT create any new files.
- Do NOT add any dependencies.

## Deliverables

| File | Action |
|---|---|
| `.github/workflows/ci.yml` | Add `lint-and-test-web` job |
| `.github/workflows/deploy-api.yml` | Replace with `workflow_run` trigger |

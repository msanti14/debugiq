# DebugIQ — Hoja de Ruta

**Última actualización:** 2026-04-06  
**Propósito:** Fuente única de verdad para retomar el desarrollo. Reemplaza a `PROJECT_STATUS_AND_ROADMAP.md` como documento operativo vigente.

---

## 1. Resumen del estado pre-sprints

Antes de los 4 sprints de esta sesión, el proyecto se encontraba así:

| Área | Estado |
|---|---|
| Monorepo (`apps/api`, `apps/web`, `apps/vscode-extension`, `packages/shared-types`) | Estable |
| API (FastAPI) | Desplegada en Railway. Auth, results, teams, analytics, insights — todo funcionando. 79 tests. |
| VS Code Extension | Demo mode, Copilot integration, keychain, hook installer — publicada como `.vsix`. |
| Web (Next.js 14) | Dashboard con team analytics/insights panels. 45 tests Vitest. Sin login/register UI. Sin E2E. |
| CI | `ci.yml` con jobs para API, extension y shared-types. Sin job para web. |
| Deploy web | Sin pipeline. Sin `vercel.json`. Sin env example. Sin security headers. |
| Tests totales consolidados | 124 (backend + extension + web + shared-types) |
| Tags | `v0.1.0`, `web-mvp-checkpoint-2026-04-05` |

**Gaps principales identificados:**
1. No existía UI de login/register en la web — requería inyección manual de tokens.
2. No existía suite E2E de browser.
3. La disciplina de release web estaba muy por detrás de la del API.

---

## 2. Detalle de los Sprints 1–4

### Sprint 1 — Auth UI web

**Objetivo:** Que un usuario pueda registrarse y loguearse desde el browser sin intervención de developer.

| Paso | Commit | Fecha | Qué entregó |
|---|---|---|---|
| Step 1 | `1980af6` | 2026-04-05 23:56 | Páginas `/login` y `/register`, root layout, 51 tests |
| Step 2+3 | `9291768` | 2026-04-06 00:43 | Redirect inverso (user logueado → /dashboard), setup Tailwind, 55 tests |

**Resultado:** La web tiene auth funcional completo. Un usuario nuevo puede registrarse, loguearse, y llegar al dashboard. Rutas protegidas redirigen correctamente. Logout limpia sesión.

---

### Sprint 2 — E2E smoke foundation

**Objetivo:** Validar el happy-path real en browser con Playwright.

| Commit | Fecha | Qué entregó |
|---|---|---|
| `5167cdf` | 2026-04-06 02:48 | Playwright setup, 5 tests E2E pasando, helper `registerAndStoreTokens` |

**Tests E2E creados:**
1. Redirect a `/login` si no autenticado
2. Login happy path
3. Error con password incorrecto
4. Redirect inverso (logueado va a `/login` → redirige a `/dashboard`)
5. Dashboard smoke (contenido visible tras login)

**Resultado:** 60 tests totales (55 Vitest + 5 Playwright).

---

### Sprint 3 — Web release hardening

**Objetivo:** Preparar la web para deploy seguro.

| Commit | Fecha | Qué entregó |
|---|---|---|
| `34adeab` | 2026-04-06 03:06 | Security headers, `.env.local.example`, `vercel.json`, 3 tests de config |

**Detalles:**
- `next.config.mjs` con 6 security headers (X-Frame-Options DENY, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control)
- `.env.local.example` documenta `NEXT_PUBLIC_API_URL`
- `vercel.json` con framework preset
- 3 tests en `release-config.test.ts` validan que estos artefactos existan

**Resultado:** 63 tests totales (58 Vitest + 5 Playwright).

---

### Sprint 4 — CI/CD workflows

**Objetivo:** Pipeline completo: CI para web + deploy automático para API y web.

| Paso | Commit | Fecha | Qué entregó |
|---|---|---|---|
| 4A | `bec1612` | 2026-04-06 03:24 | Job `lint-and-test-web` en `ci.yml` (lint + typecheck + 58 Vitest). Deploy API gated on CI success. |
| 4B | `1596b3b` | 2026-04-06 03:28 | `deploy-web.yml` (Vercel CLI). `docs/deploy/DEPLOY_SETUP.md` (runbook operativo). |

**Flujo resultante:**
```
push to main
  └── ci.yml (4 jobs: API, extension, shared-types, web)
        ├── on success → deploy-api.yml  (Railway)
        └── on success → deploy-web.yml  (Vercel)
```

**Resultado:** Pipeline CI/CD completo. Ningún deploy se ejecuta si CI falla. Ni CI ni deploys corren en PRs (solo en push a main).

---

## 3. Estado actual consolidado

### Tests

| Suite | Cantidad | Framework |
|---|---|---|
| Vitest (web) | 58 | vitest |
| Playwright E2E (web) | 5 | @playwright/test |
| pytest (API) | 79 | pytest |
| Vitest (extension) | — | vitest |
| **Total estimado** | **140+** | — |

### Código limpio

- `pnpm build`: clean (8 routes, 0 errors)
- `pnpm typecheck`: clean
- `pnpm lint`: clean
- Zero `TODO`/`FIXME` en código propio (`apps/*/src/**`, `packages/*/src/**`)

### Archivos clave creados en estos sprints

| Archivo | Sprint |
|---|---|
| `apps/web/src/app/login/page.tsx` | 1 |
| `apps/web/src/app/register/page.tsx` | 1 |
| `apps/web/e2e/auth-flow.spec.ts` | 2 |
| `apps/web/e2e/helpers/auth.ts` | 2 |
| `apps/web/next.config.mjs` | 3 |
| `apps/web/.env.local.example` | 3 |
| `apps/web/vercel.json` | 3 |
| `apps/web/src/test/release-config.test.ts` | 3 |
| `.github/workflows/deploy-web.yml` | 4B |
| `docs/deploy/DEPLOY_SETUP.md` | 4B |

---

## 4. Lo que queda pendiente (real)

Todo lo listado abajo es genuinamente pendiente. Los items que los docs anteriores marcaban como faltantes (login UI, E2E, deploy pipeline) ya fueron resueltos en los Sprints 1–4.

### 4.1 Deploy closure (pasos manuales, únicos)

Estos pasos se ejecutan una sola vez para habilitar el pipeline de deploy:

- [ ] Crear GitHub Secret `RAILWAY_TOKEN` (Railway → Account → API Tokens)
- [ ] Crear GitHub Secret `VERCEL_TOKEN` (Vercel → Settings → Tokens)
- [ ] Crear GitHub Variable `NEXT_PUBLIC_API_URL` con la URL de Railway (sin trailing slash)
- [ ] Ejecutar `vercel link` desde `apps/web` y commitear `.vercel/project.json`
- [ ] Configurar en Railway: `ALLOWED_WEB_ORIGIN = https://<dominio-vercel>`
- [ ] Primer deploy real: push a main → CI green → deploys ejecutan
- [ ] Smoke test: `GET <railway-url>/health` → `{"status": "ok"}`
- [ ] Smoke test: abrir `<vercel-url>`, registrarse, loguearse, ver dashboard

### 4.2 Release quality — siguiente nivel

- [ ] E2E en CI (nightly o en push, con API mock o servicio de test)
- [ ] Deploy triggers inteligentes (path-based: `apps/api/**` solo dispara deploy API, etc.)
- [ ] Dependency audit / secret scan en CI (`npm audit`, `pip-audit`, GitHub secret scanning)
- [ ] Branch protection rules en GitHub (require CI pass, require reviews)

### 4.3 Observabilidad

- [ ] Error tracking (Sentry o similar) en web y API
- [ ] Métricas de negocio (dashboards de uso, analytics de adopción)
- [ ] Alertas de deploy health (Railway health checks, Vercel deployment notifications)
- [ ] Structured logging en API (JSON logs para Railway)

### 4.4 Deuda técnica

- [ ] Auth → migrar de `localStorage` a HttpOnly cookies (seguridad de tokens)
- [ ] `postAnalyticsEvent` — agregar retry o queue para resiliencia
- [ ] Evaluar rename `active_members_last_30d` en API response (claridad semántica)
- [ ] Pass 5 changes: verificar si las mejoras de polish/hardening/observability de `e065b4c` están completamente integradas

### 4.5 Expansión de features (post-lanzamiento)

- [ ] Onboarding UX mejorado (first-run tour, empty states enriquecidos)
- [ ] Dashboard más rico (tablas con filtros, gráficos temporales, exports)
- [ ] Billing / tier enforcement (planes, límites, upgrade flow)
- [ ] Dojo / progress mechanics (gamificación del aprendizaje de debugging)
- [ ] Extension ↔ Web bridge (deep links, sync de estado, notificaciones cruzadas)
- [ ] Profile / settings page en la web

---

## 5. Rutas de lanzamiento

### Ruta A — Launch interno (inmediato)

Ejecutar solo la sección 4.1 (deploy closure). Resultado: producto funcionando en producción para uso interno y demos.

**Esfuerzo:** ~1 hora de configuración manual.

### Ruta B — Launch con red de seguridad

Ruta A + secciones 4.2 y 4.3 (release quality + observabilidad). Resultado: producto en producción con CI/CD confiable y visibilidad de errores.

### Ruta C — Pre-public beta

Ruta B + sección 4.4 (deuda técnica, especialmente auth hardening con HttpOnly cookies). Resultado: producto listo para usuarios externos.

---

## 6. Documentos a actualizar / cerrar

Estos documentos contienen información desactualizada tras los Sprints 1–4:

| Documento | Problema | Acción sugerida |
|---|---|---|
| `PROJECT_STATUS_AND_ROADMAP.md` | Dice que login UI y E2E no existen. Los sprints 1-4 fueron su "recommended roadmap" y ya se ejecutaron. | Archivar o agregar nota "superseded by HOJA_DE_RUTA.md" |
| `docs/RELEASE_CHECKLIST.md` §13 | "Pending for next iteration" lista login UI y E2E como pendientes | Marcar como completados |
| `docs/RELEASE_CHECKLIST.md` §14 | "Tomorrow Start Checklist" ya no aplica | Remover o actualizar |
| `docs/issues/issue-login-register-ui.md` | Describe un gap que Sprint 1 resolvió | Cerrar |
| `docs/issues/web-login-register-ui-debt.md` | Idem | Cerrar |
| `docs/issues/issue-e2e-dashboard-smoke.md` | Describe un gap que Sprint 2 resolvió | Cerrar |
| `docs/issues/e2e-dashboard-smoke-debt.md` | Idem | Cerrar |

---

## 7. Cómo retomar mañana

```bash
# 1. Sync
cd ~/debugiq && git checkout main && git pull origin main

# 2. Validar baseline
pnpm --filter @debugiq/web typecheck
pnpm --filter @debugiq/web test
cd apps/api && . .venv/bin/activate && pytest -q && cd ../..

# 3. Decidir ruta (A, B, o C) y ejecutar la sección correspondiente del punto 4.

# 4. Si se va a trabajar con OpenCode, pasarle este documento como contexto:
#    "Lee HOJA_DE_RUTA.md y ejecutá la sección X"
```

---

## 8. Convenciones de trabajo

- **Commits:** conventional commits (`feat:`, `fix:`, `ci:`, `docs:`, `perf:`, `chore:`)
- **Sprints:** cada sprint se documenta como prompt en `docs/prompts/` y se commitea con mensaje que incluye "(Sprint N)"
- **Tests:** nunca bajar la cuenta de tests. Cada sprint debe mantener o aumentar.
- **Agentes:** este doc sirve de contexto tanto para el usuario, como para Copilot (este chat), como para OpenCode.
- **Deploy:** siempre a través del pipeline CI → deploy. Nunca deploy manual directo.

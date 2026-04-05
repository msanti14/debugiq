import re

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from src.analytics.router import router as analytics_router
from src.auth.router import router as auth_router
from src.core.config import settings
from src.db.session import get_db
from src.results.router import router as results_router
from src.teams.router import router as teams_router
from src.users.router import router as users_router

app = FastAPI(
    title="DebugIQ API",
    version=settings.app_version,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url=None,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Always allow VS Code webviews and localhost dev origins.
# If ALLOWED_WEB_ORIGIN is set (e.g. https://debugiq.vercel.app), that exact
# origin is also allowed. No wildcard is ever used in production.
_base_origins = r"vscode-webview://.*|https?://localhost(:\d+)?"

if settings.allowed_web_origin:
    _escaped = re.escape(settings.allowed_web_origin)
    _cors_regex = rf"^({_base_origins}|{_escaped})$"
else:
    _cors_regex = rf"^({_base_origins})$"

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=_cors_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/v0")
app.include_router(users_router, prefix="/v0")
app.include_router(results_router, prefix="/v0")
app.include_router(analytics_router, prefix="/v0")
app.include_router(teams_router, prefix="/v0")


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
def health(db: Session = Depends(get_db)) -> JSONResponse:
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"

    status_code = 200 if db_status == "connected" else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ok" if db_status == "connected" else "degraded",
            "db": db_status,
            "version": settings.app_version,
        },
    )

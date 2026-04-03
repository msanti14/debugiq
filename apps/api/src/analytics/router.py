"""Analytics router — POST /v0/analytics/events

Accepts structured analytics events from the VS Code extension.
Only fires when the user is logged in; user_id is extracted from the JWT.
Raw code is never accepted — only hashes and enums in `properties`.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from src.core.dependencies import get_current_user
from src.db.models import AnalyticsEvent, User
from src.db.session import get_db

router = APIRouter(prefix="/analytics", tags=["analytics"])

# ── Allowed event types ───────────────────────────────────────────────────────

ALLOWED_EVENT_TYPES = {
    "signature_generated",
    "signature_repeated",
    "hook_warning_shown",
    "hook_installed",
}

# ── Schemas ───────────────────────────────────────────────────────────────────


class PostAnalyticsEventRequest(BaseModel):
    event_type: str
    properties: dict = {}

    @field_validator("event_type")
    @classmethod
    def event_type_must_be_known(cls, v: str) -> str:
        if v not in ALLOWED_EVENT_TYPES:
            raise ValueError(f"unknown event_type: {v!r}")
        return v


class PostAnalyticsEventResponse(BaseModel):
    event_id: str


# ── Endpoint ──────────────────────────────────────────────────────────────────


@router.post(
    "/events",
    response_model=PostAnalyticsEventResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_analytics_event(
    body: PostAnalyticsEventRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record an analytics event for the authenticated user."""
    if not current_user.is_active:
        raise HTTPException(status_code=403, detail="account_inactive")

    event = AnalyticsEvent(
        user_id=current_user.id,
        event_type=body.event_type,
        properties=body.properties,
        occurred_at=datetime.now(UTC),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return PostAnalyticsEventResponse(event_id=str(event.id))

"""Analytics router — POST /v0/analytics/events

Accepts structured analytics events from the VS Code extension.
Only fires when the user is logged in; user_id is extracted from the JWT.
Raw code is never accepted — only hashes and enums in `properties`.
The `properties` schema is intentionally closed (extra="forbid") to prevent
arbitrary data from reaching the database.
"""

import re
from datetime import UTC, datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
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

# SHA-256 hex: exactly 64 lowercase hex characters.
_SHA256_RE = re.compile(r"^[a-f0-9]{64}$")


# ── Schemas ───────────────────────────────────────────────────────────────────


class AnalyticsProperties(BaseModel):
    """Closed schema for analytics event properties.

    Only known structured fields are accepted; extra keys are rejected with 422.
    Hash fields must be lowercase 64-character SHA-256 hex strings.
    """

    model_config = ConfigDict(extra="forbid")

    signature_hash: Optional[str] = None
    status: Optional[Literal["new", "repeated"]] = None
    severity_summary: Optional[Literal["critical", "high", "medium", "low", "info", "none"]] = None
    mode: Optional[Literal["quick", "learn"]] = None
    language: Optional[Literal["python", "typescript"]] = None
    repo_key_hash: Optional[str] = None

    @field_validator("signature_hash", "repo_key_hash")
    @classmethod
    def must_be_sha256_hex(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not _SHA256_RE.match(v):
            raise ValueError("must be a lowercase 64-character SHA-256 hex string")
        return v


class PostAnalyticsEventRequest(BaseModel):
    event_type: str
    properties: AnalyticsProperties = Field(default_factory=AnalyticsProperties)

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
        properties=body.properties.model_dump(exclude_none=True),
        occurred_at=datetime.now(UTC),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return PostAnalyticsEventResponse(event_id=str(event.id))

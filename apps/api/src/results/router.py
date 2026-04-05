import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from src.core.dependencies import get_current_user
from src.db.models import AnalysisResult, TeamMember, User
from src.db.session import get_db

router = APIRouter(prefix="/results", tags=["results"])

# ── Schemas ────────────────────────────────────────────────────────────────────

BugCategory = Literal[
    "sql_injection",
    "null_unhandled",
    "hardcoded_secret",
    "bare_exception",
    "client_side_auth",
    "cors_misconfigured",
    "xss",
    "other",
]

Severity = Literal["critical", "high", "medium", "low", "info"]


class Finding(BaseModel):
    id: str
    category: BugCategory
    severity: Severity
    title: str
    description: str
    line_start: int
    line_end: int
    fix_hint: str | None = None
    explanation: str | None = None


class SaveResultRequest(BaseModel):
    language: Literal["python", "typescript"]
    mode: Literal["quick", "learn"]
    code_hash: str  # SHA-256 only — raw code is explicitly excluded
    findings: list[Finding]
    model_used: str
    duration_ms: int | None = None
    demo_mode: bool = False
    analyzed_at: datetime
    team_id: str | None = None

    @field_validator("code_hash")
    @classmethod
    def validate_hash(cls, v: str) -> str:
        if len(v) != 64:
            raise ValueError("code_hash must be a 64-character SHA-256 hex string")
        return v


class SaveResultResponse(BaseModel):
    result_id: str
    created_at: datetime


class ResultResponse(BaseModel):
    result_id: str
    user_id: str
    language: str
    mode: str
    code_hash: str
    findings_count: int
    findings: list[Finding]
    model_used: str
    duration_ms: int | None
    demo_mode: bool
    analyzed_at: datetime
    created_at: datetime


class PaginatedResults(BaseModel):
    items: list[ResultResponse]
    total: int
    page: int
    page_size: int


# ── Endpoints ──────────────────────────────────────────────────────────────────


@router.post("", response_model=SaveResultResponse, status_code=status.HTTP_201_CREATED)
def save_result(
    body: SaveResultRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SaveResultResponse:
    team_uuid: uuid.UUID | None = None
    if body.team_id is not None:
        try:
            team_uuid = uuid.UUID(body.team_id)
        except ValueError:
            raise HTTPException(status_code=422, detail="invalid_team_id")
        membership = (
            db.query(TeamMember)
            .filter(TeamMember.team_id == team_uuid, TeamMember.user_id == current_user.id)
            .first()
        )
        if not membership:
            raise HTTPException(status_code=403, detail="not_a_member")

    result = AnalysisResult(
        user_id=current_user.id,
        language=body.language,
        mode=body.mode,
        code_hash=body.code_hash,
        findings_count=len(body.findings),
        findings=[f.model_dump() for f in body.findings],
        model_used=body.model_used,
        duration_ms=body.duration_ms,
        demo_mode=body.demo_mode,
        analyzed_at=body.analyzed_at,
        team_id=team_uuid,
    )
    db.add(result)
    db.commit()
    db.refresh(result)
    return SaveResultResponse(result_id=str(result.id), created_at=result.created_at)


@router.get("/{result_id}", response_model=ResultResponse)
def get_result(
    result_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ResultResponse:
    try:
        rid = uuid.UUID(result_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="result_not_found")
    result = db.query(AnalysisResult).filter(AnalysisResult.id == rid).first()
    if not result:
        raise HTTPException(status_code=404, detail="result_not_found")

    # Owner access
    if result.user_id == current_user.id:
        return _to_response(result)

    # Team member access
    if result.team_id is not None:
        membership = (
            db.query(TeamMember)
            .filter(TeamMember.team_id == result.team_id, TeamMember.user_id == current_user.id)
            .first()
        )
        if membership:
            return _to_response(result)

    raise HTTPException(status_code=404, detail="result_not_found")


@router.get("", response_model=PaginatedResults)
def list_results(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    language: str | None = Query(default=None),
    mode: str | None = Query(default=None),
    team_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedResults:
    if team_id is not None:
        try:
            tid = uuid.UUID(team_id)
        except ValueError:
            raise HTTPException(status_code=422, detail="invalid_team_id")
        membership = (
            db.query(TeamMember)
            .filter(TeamMember.team_id == tid, TeamMember.user_id == current_user.id)
            .first()
        )
        if not membership:
            raise HTTPException(status_code=403, detail="not_a_member")
        query = db.query(AnalysisResult).filter(AnalysisResult.team_id == tid)
    else:
        query = db.query(AnalysisResult).filter(AnalysisResult.user_id == current_user.id)

    if language:
        query = query.filter(AnalysisResult.language == language)
    if mode:
        query = query.filter(AnalysisResult.mode == mode)

    total = query.count()
    items = (
        query.order_by(AnalysisResult.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return PaginatedResults(
        items=[_to_response(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
    )


def _to_response(r: AnalysisResult) -> ResultResponse:
    return ResultResponse(
        result_id=str(r.id),
        user_id=str(r.user_id),
        language=r.language,
        mode=r.mode,
        code_hash=r.code_hash,
        findings_count=r.findings_count,
        findings=[Finding(**f) for f in r.findings],
        model_used=r.model_used,
        duration_ms=r.duration_ms,
        demo_mode=r.demo_mode,
        analyzed_at=r.analyzed_at,
        created_at=r.created_at,
    )

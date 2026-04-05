"""
Teams router — /v0/teams
"""

import uuid
from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.core.dependencies import get_current_user
from src.db.models import AnalysisResult, Team, TeamMember, User
from src.db.session import get_db

router = APIRouter(prefix="/teams", tags=["teams"])


# ── Schemas ────────────────────────────────────────────────────────────────────


class CreateTeamRequest(BaseModel):
    name: str


class TeamResponse(BaseModel):
    team_id: str
    name: str
    owner_id: str
    tier: str
    created_at: str


class TeamMemberResponse(BaseModel):
    user_id: str
    email: str
    role: str


class AddMemberRequest(BaseModel):
    email: str
    role: Literal["admin", "member"]


class SeverityCounts(BaseModel):
    critical: int
    high: int
    medium: int
    low: int
    info: int


class ModeCounts(BaseModel):
    quick: int
    learn: int


class LanguageCounts(BaseModel):
    python: int
    typescript: int


class TeamAnalyticsSummary(BaseModel):
    total_results: int
    results_last_7d: int
    results_last_30d: int
    severity_counts: SeverityCounts
    mode_counts: ModeCounts
    language_counts: LanguageCounts
    active_members_last_30d: int


class DailyResultCount(BaseModel):
    date: str  # ISO date YYYY-MM-DD
    count: int


class CategoryCount(BaseModel):
    category: str
    count: int


class SignatureCount(BaseModel):
    signature_hash: str
    count: int


class MemberActivityEntry(BaseModel):
    user_id: str
    display_name: str | None
    results_count: int


class TeamInsights(BaseModel):
    daily_results_last_14d: list[DailyResultCount]
    top_bug_categories_last_30d: list[CategoryCount]
    top_signatures_last_30d: list[SignatureCount]
    member_activity_last_30d: list[MemberActivityEntry]


# ── Helpers ────────────────────────────────────────────────────────────────────


def _get_team_or_404(db: Session, team_id: str) -> Team:
    try:
        tid = uuid.UUID(team_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="team_not_found")
    team = db.query(Team).filter(Team.id == tid).first()
    if not team:
        raise HTTPException(status_code=404, detail="team_not_found")
    return team


def _require_member(db: Session, team: Team, user: User) -> TeamMember:
    member = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team.id, TeamMember.user_id == user.id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=403, detail="not_a_member")
    return member


def _to_team_response(team: Team) -> TeamResponse:
    return TeamResponse(
        team_id=str(team.id),
        name=team.name,
        owner_id=str(team.owner_id),
        tier=team.tier,
        created_at=team.created_at.isoformat(),
    )


def _get_db_gen() -> Generator[Session, None, None]:
    yield from get_db()


def _ensure_utc(dt: datetime) -> datetime:
    """Return a UTC-aware datetime regardless of whether dt carries tzinfo."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


# ── Endpoints ──────────────────────────────────────────────────────────────────


@router.get("", response_model=list[TeamResponse])
def list_teams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TeamResponse]:
    memberships = db.query(TeamMember).filter(TeamMember.user_id == current_user.id).all()
    team_ids = [m.team_id for m in memberships]
    if not team_ids:
        return []
    teams = db.query(Team).filter(Team.id.in_(team_ids)).all()
    return [_to_team_response(t) for t in teams]


@router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
def create_team(
    body: CreateTeamRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TeamResponse:
    team = Team(name=body.name, owner_id=current_user.id)
    db.add(team)
    db.flush()  # get team.id before adding member

    owner_member = TeamMember(team_id=team.id, user_id=current_user.id, role="owner")
    db.add(owner_member)
    db.commit()
    db.refresh(team)
    return _to_team_response(team)


@router.get("/{team_id}", response_model=TeamResponse)
def get_team(
    team_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TeamResponse:
    team = _get_team_or_404(db, team_id)
    _require_member(db, team, current_user)
    return _to_team_response(team)


@router.get("/{team_id}/members", response_model=list[TeamMemberResponse])
def list_members(
    team_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TeamMemberResponse]:
    team = _get_team_or_404(db, team_id)
    _require_member(db, team, current_user)

    members = (
        db.query(TeamMember, User)
        .join(User, TeamMember.user_id == User.id)
        .filter(TeamMember.team_id == team.id)
        .all()
    )
    return [
        TeamMemberResponse(user_id=str(m.user_id), email=u.email, role=m.role) for m, u in members
    ]


@router.post(
    "/{team_id}/members",
    response_model=TeamMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_member(
    team_id: str,
    body: AddMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TeamMemberResponse:
    team = _get_team_or_404(db, team_id)
    caller = _require_member(db, team, current_user)

    if caller.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="insufficient_role")

    target = db.query(User).filter(User.email == body.email).first()
    if not target:
        raise HTTPException(status_code=404, detail="user_not_found")

    new_member = TeamMember(team_id=team.id, user_id=target.id, role=body.role)
    db.add(new_member)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="already_a_member")

    return TeamMemberResponse(user_id=str(target.id), email=target.email, role=body.role)


@router.get("/{team_id}/analytics/summary", response_model=TeamAnalyticsSummary)
def get_team_analytics_summary(
    team_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TeamAnalyticsSummary:
    team = _get_team_or_404(db, team_id)
    _require_member(db, team, current_user)

    results: list[AnalysisResult] = (
        db.query(AnalysisResult).filter(AnalysisResult.team_id == team.id).all()
    )

    now = datetime.now(UTC)
    cutoff_7d = now - timedelta(days=7)
    cutoff_30d = now - timedelta(days=30)

    total_results = len(results)
    results_last_7d = sum(1 for r in results if _ensure_utc(r.created_at) >= cutoff_7d)
    results_last_30d = sum(1 for r in results if _ensure_utc(r.created_at) >= cutoff_30d)

    sev: dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for r in results:
        for finding in r.findings:
            s = str(finding.get("severity", "")) if isinstance(finding, dict) else ""
            if s in sev:
                sev[s] += 1

    mode: dict[str, int] = {"quick": 0, "learn": 0}
    for r in results:
        if r.mode in mode:
            mode[r.mode] += 1

    lang: dict[str, int] = {"python": 0, "typescript": 0}
    for r in results:
        if r.language in lang:
            lang[r.language] += 1

    active_users: set[uuid.UUID] = {
        r.user_id for r in results if _ensure_utc(r.created_at) >= cutoff_30d
    }

    return TeamAnalyticsSummary(
        total_results=total_results,
        results_last_7d=results_last_7d,
        results_last_30d=results_last_30d,
        severity_counts=SeverityCounts(**sev),
        mode_counts=ModeCounts(**mode),
        language_counts=LanguageCounts(**lang),
        active_members_last_30d=len(active_users),
    )


@router.get("/{team_id}/analytics/insights", response_model=TeamInsights)
def get_team_analytics_insights(
    team_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TeamInsights:
    team = _get_team_or_404(db, team_id)
    _require_member(db, team, current_user)

    all_results: list[AnalysisResult] = (
        db.query(AnalysisResult).filter(AnalysisResult.team_id == team.id).all()
    )

    now = datetime.now(UTC)
    cutoff_14d = now - timedelta(days=14)
    cutoff_30d = now - timedelta(days=30)

    results_last_30d = [r for r in all_results if _ensure_utc(r.created_at) >= cutoff_30d]
    results_last_14d = [r for r in results_last_30d if _ensure_utc(r.created_at) >= cutoff_14d]

    # ── Daily activity: build a full 14-day range, fill zeros for missing days ──
    daily_counts: dict[str, int] = {
        (now - timedelta(days=13 - i)).date().isoformat(): 0 for i in range(14)
    }
    for r in results_last_14d:
        day = _ensure_utc(r.created_at).date().isoformat()
        if day in daily_counts:
            daily_counts[day] += 1
    daily_results_last_14d = [
        DailyResultCount(date=d, count=c) for d, c in sorted(daily_counts.items())
    ]

    # ── Top bug categories: aggregate finding.category from last 30d ──────────
    category_counts: dict[str, int] = {}
    for r in results_last_30d:
        for finding in r.findings:
            if isinstance(finding, dict):
                cat = str(finding.get("category", "")).strip()
                if cat:
                    category_counts[cat] = category_counts.get(cat, 0) + 1
    top_bug_categories_last_30d = [
        CategoryCount(category=cat, count=cnt)
        for cat, cnt in sorted(category_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    ]

    # ── Top signatures: group by code_hash from last 30d ─────────────────────
    sig_counts: dict[str, int] = {}
    for r in results_last_30d:
        sig_counts[r.code_hash] = sig_counts.get(r.code_hash, 0) + 1
    top_signatures_last_30d = [
        SignatureCount(signature_hash=sig, count=cnt)
        for sig, cnt in sorted(sig_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    ]

    # ── Member activity: group by user_id, join display_name ──────────────────
    member_counts: dict[uuid.UUID, int] = {}
    for r in results_last_30d:
        member_counts[r.user_id] = member_counts.get(r.user_id, 0) + 1

    member_activity_last_30d: list[MemberActivityEntry] = []
    for uid, cnt in sorted(member_counts.items(), key=lambda x: x[1], reverse=True):
        user = db.query(User).filter(User.id == uid).first()
        member_activity_last_30d.append(
            MemberActivityEntry(
                user_id=str(uid),
                display_name=user.display_name if user else None,
                results_count=cnt,
            )
        )

    return TeamInsights(
        daily_results_last_14d=daily_results_last_14d,
        top_bug_categories_last_30d=top_bug_categories_last_30d,
        top_signatures_last_30d=top_signatures_last_30d,
        member_activity_last_30d=member_activity_last_30d,
    )

"""
Teams router — /v0/teams
"""

import uuid
from collections.abc import Generator
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.core.dependencies import get_current_user
from src.db.models import Team, TeamMember, User
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


class TeamMemberResponse(BaseModel):
    user_id: str
    email: str
    role: str


class AddMemberRequest(BaseModel):
    email: str
    role: Literal["admin", "member"]


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
    )


def _get_db_gen() -> Generator[Session, None, None]:
    yield from get_db()


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

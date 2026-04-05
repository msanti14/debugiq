from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.core.dependencies import get_current_user
from src.db.models import User
from src.db.session import get_db

router = APIRouter(prefix="/users", tags=["users"])


class UserResponse(BaseModel):
    user_id: str
    email: str
    display_name: str | None
    tier: str
    created_at: datetime


class PatchUserRequest(BaseModel):
    display_name: str | None = None


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(
        user_id=str(current_user.id),
        email=current_user.email,
        display_name=current_user.display_name,
        tier=current_user.tier,
        created_at=current_user.created_at,
    )


@router.patch("/me", response_model=UserResponse)
def patch_me(
    body: PatchUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    if body.display_name is not None:
        current_user.display_name = body.display_name
        current_user.updated_at = datetime.now(UTC)
        db.commit()
        db.refresh(current_user)

    return UserResponse(
        user_id=str(current_user.id),
        email=current_user.email,
        display_name=current_user.display_name,
        tier=current_user.tier,
        created_at=current_user.created_at,
    )

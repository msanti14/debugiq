"""initial_schema

Revision ID: 6d0a6f152748
Revises:
Create Date: 2026-04-02

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "6d0a6f152748"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("email", sa.Text, nullable=False, unique=True),
        sa.Column("password_hash", sa.Text, nullable=False),
        sa.Column("display_name", sa.Text, nullable=True),
        sa.Column("tier", sa.String(20), nullable=False, server_default="free"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "teams",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("tier", sa.String(20), nullable=False, server_default="free"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )

    op.create_table(
        "team_members",
        sa.Column(
            "team_id",
            UUID(as_uuid=True),
            sa.ForeignKey("teams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(20), nullable=False, server_default="member"),
        sa.Column(
            "joined_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")
        ),
        sa.PrimaryKeyConstraint("team_id", "user_id"),
    )

    op.create_table(
        "refresh_tokens",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.Text, nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])

    op.create_table(
        "analysis_results",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("team_id", UUID(as_uuid=True), sa.ForeignKey("teams.id"), nullable=True),
        sa.Column("language", sa.String(30), nullable=False),
        sa.Column("mode", sa.String(20), nullable=False),
        sa.Column("code_hash", sa.Text, nullable=False),
        sa.Column("findings_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("findings", JSONB, nullable=False, server_default="'[]'"),
        sa.Column("model_used", sa.Text, nullable=False),
        sa.Column("duration_ms", sa.Integer, nullable=True),
        sa.Column("demo_mode", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("analyzed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("ix_analysis_results_user_id", "analysis_results", ["user_id"])
    op.create_index("ix_analysis_results_code_hash", "analysis_results", ["code_hash"])
    op.create_index("ix_analysis_results_created_at", "analysis_results", ["created_at"])

    op.create_table(
        "analytics_events",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("event_type", sa.Text, nullable=False),
        sa.Column("properties", JSONB, nullable=False, server_default="'{}'"),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("ix_analytics_events_user_id", "analytics_events", ["user_id"])
    op.create_index("ix_analytics_events_event_type", "analytics_events", ["event_type"])


def downgrade() -> None:
    op.drop_table("analytics_events")
    op.drop_table("analysis_results")
    op.drop_table("refresh_tokens")
    op.drop_table("team_members")
    op.drop_table("teams")
    op.drop_table("users")

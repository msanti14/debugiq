"""add analysis_results composite indexes

Revision ID: 1183644aa765
Revises: 6d0a6f152748
Create Date: 2026-04-05 20:11:49.559191

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '1183644aa765'
down_revision: str | Sequence[str] | None = '6d0a6f152748'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_analysis_results_team_id_created_at
        ON analysis_results (team_id, created_at)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_analysis_results_team_id_user_id_created_at
        ON analysis_results (team_id, user_id, created_at)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_analysis_results_team_id_code_hash_created_at
        ON analysis_results (team_id, code_hash, created_at)
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP INDEX IF EXISTS ix_analysis_results_team_id_code_hash_created_at")
    op.execute("DROP INDEX IF EXISTS ix_analysis_results_team_id_user_id_created_at")
    op.execute("DROP INDEX IF EXISTS ix_analysis_results_team_id_created_at")

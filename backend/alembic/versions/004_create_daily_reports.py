"""create daily_reports table

Revision ID: 004_create_daily_reports
Revises: 003_create_status_tables
Create Date: 2026-06-22

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "004_create_daily_reports"
down_revision: Union[str, None] = "003_create_status_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "daily_reports",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("today_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("blockers_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("tomorrow_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "date", name="uq_daily_reports_user_date"),
    )
    op.create_index("ix_daily_reports_user_id", "daily_reports", ["user_id"])
    op.create_index("ix_daily_reports_date", "daily_reports", ["date"])


def downgrade() -> None:
    op.drop_index("ix_daily_reports_date", table_name="daily_reports")
    op.drop_index("ix_daily_reports_user_id", table_name="daily_reports")
    op.drop_table("daily_reports")

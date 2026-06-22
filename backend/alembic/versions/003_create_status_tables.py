"""create status tables

Revision ID: 003_create_status_tables
Revises: 002_create_work_sessions
Create Date: 2026-06-22

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "003_create_status_tables"
down_revision: Union[str, None] = "002_create_work_sessions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_statuses",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_table(
        "status_logs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_status_logs_user_id", "status_logs", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_status_logs_user_id", table_name="status_logs")
    op.drop_table("status_logs")
    op.drop_table("user_statuses")

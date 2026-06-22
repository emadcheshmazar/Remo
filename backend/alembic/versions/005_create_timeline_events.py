"""create timeline_events table

Revision ID: 005_create_timeline_events
Revises: 004_create_daily_reports
Create Date: 2026-06-22

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "005_create_timeline_events"
down_revision: Union[str, None] = "004_create_daily_reports"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "timeline_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_timeline_events_user_id", "timeline_events", ["user_id"])
    op.create_index("ix_timeline_events_occurred_at", "timeline_events", ["occurred_at"])


def downgrade() -> None:
    op.drop_index("ix_timeline_events_occurred_at", table_name="timeline_events")
    op.drop_index("ix_timeline_events_user_id", table_name="timeline_events")
    op.drop_table("timeline_events")

"""create day_entries

Revision ID: 007
Revises: 006
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = "007_create_day_entries"
down_revision = "006_add_supervisor_id"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "day_entries",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("day_type", sa.String(16), nullable=False),  # REMOTE / ON_SITE / LEAVE
        sa.Column("set_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("user_id", "date", name="uq_day_entries_user_date"),
    )
    op.create_index("ix_day_entries_user_id", "day_entries", ["user_id"])
    op.create_index("ix_day_entries_date", "day_entries", ["date"])


def downgrade():
    op.drop_table("day_entries")

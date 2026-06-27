"""add supervisor_id to users

Revision ID: 006_add_supervisor_id
Revises: 005_create_timeline_events
Create Date: 2026-06-23

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "006_add_supervisor_id"
down_revision: Union[str, None] = "005_create_timeline_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("supervisor_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_users_supervisor_id",
        "users", "users",
        ["supervisor_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_supervisor_id", "users", type_="foreignkey")
    op.drop_column("users", "supervisor_id")

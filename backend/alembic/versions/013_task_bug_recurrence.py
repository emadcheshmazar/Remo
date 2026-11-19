"""bug fields, hot filter support, recurrence

Revision ID: 013_task_bug_recurrence
Revises: 012_task_type_attachments
Create Date: 2026-11-19
"""

from alembic import op
import sqlalchemy as sa

revision = "013_task_bug_recurrence"
down_revision = "012_task_type_attachments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("reproduction_steps", sa.Text(), nullable=True))
    op.add_column("tasks", sa.Column("screenshot_url", sa.String(500), nullable=True))
    op.add_column(
        "tasks",
        sa.Column("recurrence", sa.String(16), nullable=False, server_default="none"),
    )
    op.add_column("tasks", sa.Column("recurrence_until", sa.Date(), nullable=True))
    op.create_index("ix_tasks_recurrence", "tasks", ["recurrence"])


def downgrade() -> None:
    op.drop_index("ix_tasks_recurrence", table_name="tasks")
    op.drop_column("tasks", "recurrence_until")
    op.drop_column("tasks", "recurrence")
    op.drop_column("tasks", "screenshot_url")
    op.drop_column("tasks", "reproduction_steps")

"""jira people import support, task approval, parent tree, repo

Revision ID: 014_people_approval_tree
Revises: 013_task_bug_recurrence
Create Date: 2026-11-19
"""

from alembic import op
import sqlalchemy as sa

revision = "014_people_approval_tree"
down_revision = "013_task_bug_recurrence"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column("pipeline", sa.String(16), nullable=False, server_default="backlog"),
    )
    op.add_column(
        "tasks",
        sa.Column("approval_status", sa.String(16), nullable=False, server_default="pending"),
    )
    op.add_column(
        "tasks",
        sa.Column("approved_by", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column("tasks", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "tasks",
        sa.Column("parent_task_id", sa.UUID(), sa.ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column("tasks", sa.Column("repo_name", sa.String(200), nullable=True))
    op.create_index("ix_tasks_pipeline", "tasks", ["pipeline"])
    op.create_index("ix_tasks_approval_status", "tasks", ["approval_status"])
    op.create_index("ix_tasks_parent_task_id", "tasks", ["parent_task_id"])

    # Existing work stays usable — treat as already approved.
    op.execute(
        "UPDATE tasks SET pipeline = 'approved', approval_status = 'approved' "
        "WHERE approval_status = 'pending'"
    )


def downgrade() -> None:
    op.drop_index("ix_tasks_parent_task_id", table_name="tasks")
    op.drop_index("ix_tasks_approval_status", table_name="tasks")
    op.drop_index("ix_tasks_pipeline", table_name="tasks")
    op.drop_column("tasks", "repo_name")
    op.drop_column("tasks", "parent_task_id")
    op.drop_column("tasks", "approved_at")
    op.drop_column("tasks", "approved_by")
    op.drop_column("tasks", "approval_status")
    op.drop_column("tasks", "pipeline")

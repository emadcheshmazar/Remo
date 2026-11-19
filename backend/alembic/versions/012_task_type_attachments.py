"""task type, inbox flag, and attachments

Revision ID: 012_task_type_attachments
Revises: 011_jira_board_sprints
Create Date: 2026-11-19
"""
from alembic import op
import sqlalchemy as sa

revision = "012_task_type_attachments"
down_revision = "011_jira_board_sprints"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "tasks",
        sa.Column("task_type", sa.String(16), nullable=False, server_default="sprint"),
    )
    op.add_column(
        "tasks",
        sa.Column("needs_assignment", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_tasks_task_type", "tasks", ["task_type"])
    op.create_index("ix_tasks_needs_assignment", "tasks", ["needs_assignment"])

    op.create_table(
        "task_attachments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("task_id", sa.UUID(), nullable=False),
        sa.Column("uploaded_by", sa.UUID(), nullable=True),
        sa.Column("kind", sa.String(16), nullable=False, server_default="file"),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(120), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_task_attachments_task_id", "task_attachments", ["task_id"])


def downgrade():
    op.drop_index("ix_task_attachments_task_id", table_name="task_attachments")
    op.drop_table("task_attachments")
    op.drop_index("ix_tasks_needs_assignment", table_name="tasks")
    op.drop_index("ix_tasks_task_type", table_name="tasks")
    op.drop_column("tasks", "needs_assignment")
    op.drop_column("tasks", "task_type")

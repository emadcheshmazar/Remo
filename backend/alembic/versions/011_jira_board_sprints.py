"""jira board columns and sprints

Revision ID: 011_jira_board_sprints
Revises: 010_create_tasks_and_jira
Create Date: 2026-11-19
"""
from alembic import op
import sqlalchemy as sa


revision = "011_jira_board_sprints"
down_revision = "010_create_tasks_and_jira"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("jira_connections", sa.Column("board_id", sa.Integer(), nullable=True))
    op.add_column("jira_connections", sa.Column("board_name", sa.String(200), nullable=True))
    op.add_column(
        "jira_connections",
        sa.Column("board_columns", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
    )

    op.alter_column(
        "tasks",
        "status",
        existing_type=sa.String(16),
        type_=sa.String(64),
        existing_nullable=False,
        existing_server_default="todo",
    )
    op.add_column("tasks", sa.Column("jira_status_id", sa.String(64), nullable=True))
    op.add_column("tasks", sa.Column("jira_status_name", sa.String(100), nullable=True))
    op.add_column("tasks", sa.Column("board_column", sa.String(100), nullable=True))
    op.add_column("tasks", sa.Column("jira_sprint_id", sa.Integer(), nullable=True))
    op.add_column("tasks", sa.Column("jira_sprint_name", sa.String(200), nullable=True))


def downgrade():
    op.drop_column("tasks", "jira_sprint_name")
    op.drop_column("tasks", "jira_sprint_id")
    op.drop_column("tasks", "board_column")
    op.drop_column("tasks", "jira_status_name")
    op.drop_column("tasks", "jira_status_id")
    op.alter_column(
        "tasks",
        "status",
        existing_type=sa.String(64),
        type_=sa.String(16),
        existing_nullable=False,
        existing_server_default="todo",
    )

    op.drop_column("jira_connections", "board_columns")
    op.drop_column("jira_connections", "board_name")
    op.drop_column("jira_connections", "board_id")

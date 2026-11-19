"""tasks, labels, and jira sync tables

Revision ID: 010_create_tasks_and_jira
Revises: 009_add_notes_to_day_entries
Create Date: 2026-11-19
"""
from alembic import op
import sqlalchemy as sa

revision = "010_create_tasks_and_jira"
down_revision = "009_add_notes_to_day_entries"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE SEQUENCE IF NOT EXISTS task_key_seq START 1")

    op.create_table(
        "tasks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("local_key", sa.String(32), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("estimate_minutes", sa.Integer(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("priority", sa.String(16), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(16), nullable=False, server_default="todo"),
        sa.Column("reporter_id", sa.UUID(), nullable=False),
        sa.Column("org_manager_id", sa.UUID(), nullable=True),
        sa.Column("source", sa.String(16), nullable=False, server_default="remo"),
        sa.Column("sync_origin", sa.String(16), nullable=True),
        sa.Column("sync_fingerprint", sa.String(64), nullable=True),
        sa.Column("jira_issue_id", sa.String(64), nullable=True),
        sa.Column("jira_issue_key", sa.String(64), nullable=True),
        sa.Column("jira_sync_status", sa.String(32), nullable=False, server_default="not_configured"),
        sa.Column("jira_sync_error", sa.Text(), nullable=True),
        sa.Column("jira_last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("jira_remote_updated", sa.DateTime(timezone=True), nullable=True),
        sa.Column("jira_url", sa.String(500), nullable=True),
        sa.Column("unmapped_assignee", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["reporter_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["org_manager_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("local_key", name="uq_tasks_local_key"),
        sa.UniqueConstraint("jira_issue_id", name="uq_tasks_jira_issue_id"),
    )
    op.create_index("ix_tasks_due_date", "tasks", ["due_date"])
    op.create_index("ix_tasks_status", "tasks", ["status"])
    op.create_index("ix_tasks_org_manager_id", "tasks", ["org_manager_id"])
    op.create_index("ix_tasks_reporter_id", "tasks", ["reporter_id"])

    op.create_table(
        "task_assignees",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("task_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("task_id", "user_id", name="uq_task_assignees_task_user"),
    )
    op.create_index("ix_task_assignees_user_id", "task_assignees", ["user_id"])
    op.create_index("ix_task_assignees_task_id", "task_assignees", ["task_id"])

    op.create_table(
        "task_labels",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("org_manager_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(50), nullable=False),
        sa.Column("color", sa.String(20), nullable=False, server_default="#6366f1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["org_manager_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_manager_id", "title", name="uq_task_labels_org_title"),
    )

    op.create_table(
        "task_label_links",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("task_id", sa.UUID(), nullable=False),
        sa.Column("label_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["label_id"], ["task_labels.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("task_id", "label_id", name="uq_task_label_links"),
    )

    op.create_table(
        "task_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("task_id", sa.UUID(), nullable=False),
        sa.Column("actor_id", sa.UUID(), nullable=True),
        sa.Column("action", sa.String(32), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_task_events_task_id", "task_events", ["task_id"])

    op.create_table(
        "jira_connections",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("base_url", sa.String(500), nullable=False),
        sa.Column("auth_type", sa.String(16), nullable=False, server_default="bearer"),
        sa.Column("username", sa.String(200), nullable=True),
        sa.Column("secret_encrypted", sa.Text(), nullable=False),
        sa.Column("default_project_key", sa.String(32), nullable=False),
        sa.Column("default_issuetype_id", sa.String(32), nullable=True),
        sa.Column("default_issuetype_name", sa.String(100), nullable=False, server_default="Task"),
        sa.Column("webhook_secret", sa.String(128), nullable=False),
        sa.Column("status_map", sa.JSON(), nullable=False),
        sa.Column("configured_by", sa.UUID(), nullable=True),
        sa.Column("owner_manager_id", sa.UUID(), nullable=True),
        sa.Column("last_polled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["configured_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["owner_manager_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "jira_user_maps",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("jira_username", sa.String(200), nullable=False),
        sa.Column("jira_display_name", sa.String(200), nullable=True),
        sa.Column("jira_email", sa.String(200), nullable=True),
        sa.Column("remo_user_id", sa.UUID(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["remo_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("jira_username", name="uq_jira_user_maps_username"),
    )

    op.create_table(
        "jira_sync_jobs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("task_id", sa.UUID(), nullable=True),
        sa.Column("job_type", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_jira_sync_jobs_status", "jira_sync_jobs", ["status"])
    op.create_index("ix_jira_sync_jobs_task_id", "jira_sync_jobs", ["task_id"])


def downgrade():
    op.drop_table("jira_sync_jobs")
    op.drop_table("jira_user_maps")
    op.drop_table("jira_connections")
    op.drop_table("task_events")
    op.drop_table("task_label_links")
    op.drop_table("task_labels")
    op.drop_table("task_assignees")
    op.drop_index("ix_tasks_reporter_id", table_name="tasks")
    op.drop_index("ix_tasks_org_manager_id", table_name="tasks")
    op.drop_index("ix_tasks_status", table_name="tasks")
    op.drop_index("ix_tasks_due_date", table_name="tasks")
    op.drop_table("tasks")
    op.execute("DROP SEQUENCE IF EXISTS task_key_seq")

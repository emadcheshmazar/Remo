import uuid
from datetime import date as Date, datetime, timezone

import sqlalchemy as sa
from sqlmodel import Field, SQLModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Task(SQLModel, table=True):
    __tablename__ = "tasks"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        sa_column=sa.Column(sa.UUID(), primary_key=True, default=uuid.uuid4),
    )
    local_key: str = Field(sa_column=sa.Column(sa.String(32), nullable=False, unique=True))
    title: str = Field(sa_column=sa.Column(sa.String(255), nullable=False))
    description: str | None = Field(default=None, sa_column=sa.Column(sa.Text(), nullable=True))
    estimate_minutes: int | None = Field(default=None, sa_column=sa.Column(sa.Integer(), nullable=True))
    due_date: Date | None = Field(default=None, sa_column=sa.Column(sa.Date(), nullable=True))
    priority: str = Field(
        default="medium",
        sa_column=sa.Column(sa.String(16), nullable=False, server_default="medium"),
    )
    task_type: str = Field(
        default="sprint",
        sa_column=sa.Column(sa.String(16), nullable=False, server_default="sprint", index=True),
    )
    needs_assignment: bool = Field(
        default=False,
        sa_column=sa.Column(sa.Boolean(), nullable=False, server_default=sa.text("false"), index=True),
    )
    pipeline: str = Field(
        default="backlog",
        sa_column=sa.Column(sa.String(16), nullable=False, server_default="backlog", index=True),
    )
    approval_status: str = Field(
        default="pending",
        sa_column=sa.Column(sa.String(16), nullable=False, server_default="pending", index=True),
    )
    approved_by: uuid.UUID | None = Field(
        default=None,
        sa_column=sa.Column(sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    approved_at: datetime | None = Field(
        default=None, sa_column=sa.Column(sa.DateTime(timezone=True), nullable=True)
    )
    parent_task_id: uuid.UUID | None = Field(
        default=None,
        sa_column=sa.Column(
            sa.UUID(), sa.ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True
        ),
    )
    repo_name: str | None = Field(default=None, sa_column=sa.Column(sa.String(200), nullable=True))
    reproduction_steps: str | None = Field(default=None, sa_column=sa.Column(sa.Text(), nullable=True))
    screenshot_url: str | None = Field(default=None, sa_column=sa.Column(sa.String(500), nullable=True))
    recurrence: str = Field(
        default="none",
        sa_column=sa.Column(sa.String(16), nullable=False, server_default="none", index=True),
    )
    recurrence_until: Date | None = Field(default=None, sa_column=sa.Column(sa.Date(), nullable=True))
    status: str = Field(
        default="todo",
        sa_column=sa.Column(sa.String(64), nullable=False, server_default="todo"),
    )
    reporter_id: uuid.UUID = Field(
        sa_column=sa.Column(sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    )
    org_manager_id: uuid.UUID | None = Field(
        default=None,
        sa_column=sa.Column(sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    source: str = Field(
        default="remo",
        sa_column=sa.Column(sa.String(16), nullable=False, server_default="remo"),
    )
    sync_origin: str | None = Field(default=None, sa_column=sa.Column(sa.String(16), nullable=True))
    sync_fingerprint: str | None = Field(default=None, sa_column=sa.Column(sa.String(64), nullable=True))
    jira_issue_id: str | None = Field(default=None, sa_column=sa.Column(sa.String(64), nullable=True, unique=True))
    jira_issue_key: str | None = Field(default=None, sa_column=sa.Column(sa.String(64), nullable=True))
    jira_sync_status: str = Field(
        default="not_configured",
        sa_column=sa.Column(sa.String(32), nullable=False, server_default="not_configured"),
    )
    jira_sync_error: str | None = Field(default=None, sa_column=sa.Column(sa.Text(), nullable=True))
    jira_last_synced_at: datetime | None = Field(
        default=None, sa_column=sa.Column(sa.DateTime(timezone=True), nullable=True)
    )
    jira_remote_updated: datetime | None = Field(
        default=None, sa_column=sa.Column(sa.DateTime(timezone=True), nullable=True)
    )
    jira_url: str | None = Field(default=None, sa_column=sa.Column(sa.String(500), nullable=True))
    jira_status_id: str | None = Field(default=None, sa_column=sa.Column(sa.String(64), nullable=True))
    jira_status_name: str | None = Field(default=None, sa_column=sa.Column(sa.String(100), nullable=True))
    board_column: str | None = Field(default=None, sa_column=sa.Column(sa.String(100), nullable=True))
    jira_sprint_id: int | None = Field(default=None, sa_column=sa.Column(sa.Integer(), nullable=True))
    jira_sprint_name: str | None = Field(default=None, sa_column=sa.Column(sa.String(200), nullable=True))
    unmapped_assignee: str | None = Field(default=None, sa_column=sa.Column(sa.String(200), nullable=True))
    created_at: datetime = Field(
        default_factory=_now,
        sa_column=sa.Column(sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=_now,
        sa_column=sa.Column(sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


class TaskAssignee(SQLModel, table=True):
    __tablename__ = "task_assignees"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        sa_column=sa.Column(sa.UUID(), primary_key=True, default=uuid.uuid4),
    )
    task_id: uuid.UUID = Field(
        sa_column=sa.Column(sa.UUID(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    user_id: uuid.UUID = Field(
        sa_column=sa.Column(sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    position: int = Field(default=0, sa_column=sa.Column(sa.Integer(), nullable=False, server_default="0"))


class TaskLabel(SQLModel, table=True):
    __tablename__ = "task_labels"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        sa_column=sa.Column(sa.UUID(), primary_key=True, default=uuid.uuid4),
    )
    org_manager_id: uuid.UUID | None = Field(
        default=None,
        sa_column=sa.Column(sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
    )
    title: str = Field(sa_column=sa.Column(sa.String(50), nullable=False))
    color: str = Field(
        default="#6366f1",
        sa_column=sa.Column(sa.String(20), nullable=False, server_default="#6366f1"),
    )
    created_at: datetime = Field(
        default_factory=_now,
        sa_column=sa.Column(sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


class TaskLabelLink(SQLModel, table=True):
    __tablename__ = "task_label_links"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        sa_column=sa.Column(sa.UUID(), primary_key=True, default=uuid.uuid4),
    )
    task_id: uuid.UUID = Field(
        sa_column=sa.Column(sa.UUID(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    )
    label_id: uuid.UUID = Field(
        sa_column=sa.Column(sa.UUID(), sa.ForeignKey("task_labels.id", ondelete="CASCADE"), nullable=False)
    )


class TaskEvent(SQLModel, table=True):
    __tablename__ = "task_events"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        sa_column=sa.Column(sa.UUID(), primary_key=True, default=uuid.uuid4),
    )
    task_id: uuid.UUID = Field(
        sa_column=sa.Column(sa.UUID(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    actor_id: uuid.UUID | None = Field(
        default=None,
        sa_column=sa.Column(sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    action: str = Field(sa_column=sa.Column(sa.String(32), nullable=False))
    detail: str | None = Field(default=None, sa_column=sa.Column(sa.Text(), nullable=True))
    created_at: datetime = Field(
        default_factory=_now,
        sa_column=sa.Column(sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


class TaskAttachment(SQLModel, table=True):
    __tablename__ = "task_attachments"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        sa_column=sa.Column(sa.UUID(), primary_key=True, default=uuid.uuid4),
    )
    task_id: uuid.UUID = Field(
        sa_column=sa.Column(sa.UUID(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    uploaded_by: uuid.UUID | None = Field(
        default=None,
        sa_column=sa.Column(sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    kind: str = Field(
        default="file",
        sa_column=sa.Column(sa.String(16), nullable=False, server_default="file"),
    )
    filename: str = Field(sa_column=sa.Column(sa.String(255), nullable=False))
    content_type: str | None = Field(default=None, sa_column=sa.Column(sa.String(120), nullable=True))
    size_bytes: int = Field(default=0, sa_column=sa.Column(sa.Integer(), nullable=False, server_default="0"))
    storage_path: str = Field(sa_column=sa.Column(sa.String(500), nullable=False))
    created_at: datetime = Field(
        default_factory=_now,
        sa_column=sa.Column(sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

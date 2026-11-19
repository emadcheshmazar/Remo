import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from sqlalchemy.types import JSON
from sqlmodel import Field, SQLModel

from app.modules.jira.mapper import DEFAULT_STATUS_MAP


def _now() -> datetime:
    return datetime.now(timezone.utc)


class JiraConnection(SQLModel, table=True):
    __tablename__ = "jira_connections"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        sa_column=sa.Column(sa.UUID(), primary_key=True, default=uuid.uuid4),
    )
    base_url: str = Field(sa_column=sa.Column(sa.String(500), nullable=False))
    auth_type: str = Field(
        default="bearer",
        sa_column=sa.Column(sa.String(16), nullable=False, server_default="bearer"),
    )
    username: str | None = Field(default=None, sa_column=sa.Column(sa.String(200), nullable=True))
    secret_encrypted: str = Field(sa_column=sa.Column(sa.Text(), nullable=False))
    default_project_key: str = Field(sa_column=sa.Column(sa.String(32), nullable=False))
    default_issuetype_id: str | None = Field(default=None, sa_column=sa.Column(sa.String(32), nullable=True))
    default_issuetype_name: str = Field(
        default="Task",
        sa_column=sa.Column(sa.String(100), nullable=False, server_default="Task"),
    )
    board_id: int | None = Field(default=None, sa_column=sa.Column(sa.Integer(), nullable=True))
    board_name: str | None = Field(default=None, sa_column=sa.Column(sa.String(200), nullable=True))
    board_columns: list[dict] = Field(
        default_factory=list,
        sa_column=sa.Column(JSON, nullable=False, server_default=sa.text("'[]'::json")),
    )
    webhook_secret: str = Field(sa_column=sa.Column(sa.String(128), nullable=False))
    status_map: dict = Field(
        default_factory=lambda: {k: list(v) for k, v in DEFAULT_STATUS_MAP.items()},
        sa_column=sa.Column(JSON, nullable=False),
    )
    configured_by: uuid.UUID | None = Field(
        default=None,
        sa_column=sa.Column(sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    owner_manager_id: uuid.UUID | None = Field(
        default=None,
        sa_column=sa.Column(sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    last_polled_at: datetime | None = Field(
        default=None, sa_column=sa.Column(sa.DateTime(timezone=True), nullable=True)
    )
    created_at: datetime = Field(
        default_factory=_now,
        sa_column=sa.Column(sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=_now,
        sa_column=sa.Column(sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


class JiraUserMap(SQLModel, table=True):
    __tablename__ = "jira_user_maps"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        sa_column=sa.Column(sa.UUID(), primary_key=True, default=uuid.uuid4),
    )
    jira_username: str = Field(sa_column=sa.Column(sa.String(200), nullable=False, unique=True))
    jira_display_name: str | None = Field(default=None, sa_column=sa.Column(sa.String(200), nullable=True))
    jira_email: str | None = Field(default=None, sa_column=sa.Column(sa.String(200), nullable=True))
    remo_user_id: uuid.UUID | None = Field(
        default=None,
        sa_column=sa.Column(sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    updated_at: datetime = Field(
        default_factory=_now,
        sa_column=sa.Column(sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


class JiraSyncJob(SQLModel, table=True):
    __tablename__ = "jira_sync_jobs"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        sa_column=sa.Column(sa.UUID(), primary_key=True, default=uuid.uuid4),
    )
    task_id: uuid.UUID | None = Field(
        default=None,
        sa_column=sa.Column(sa.UUID(), sa.ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True),
    )
    job_type: str = Field(sa_column=sa.Column(sa.String(32), nullable=False))
    status: str = Field(
        default="pending",
        sa_column=sa.Column(sa.String(16), nullable=False, server_default="pending"),
    )
    attempts: int = Field(default=0, sa_column=sa.Column(sa.Integer(), nullable=False, server_default="0"))
    error: str | None = Field(default=None, sa_column=sa.Column(sa.Text(), nullable=True))
    detail: str | None = Field(default=None, sa_column=sa.Column(sa.Text(), nullable=True))
    created_at: datetime = Field(
        default_factory=_now,
        sa_column=sa.Column(sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=_now,
        sa_column=sa.Column(sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

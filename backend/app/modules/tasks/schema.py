import re
import uuid
from datetime import date as Date, datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.modules.jira.mapper import DEFAULT_STATUS_MAP


class TaskPriority:
    highest = "highest"
    high = "high"
    medium = "medium"
    low = "low"
    lowest = "lowest"
    ALL = (highest, high, medium, low, lowest)


class TaskStatus:
    todo = "todo"
    in_progress = "in_progress"
    done = "done"
    cancelled = "cancelled"
    ALL = (todo, in_progress, done, cancelled)


class TaskType:
    sprint = "sprint"
    urgent = "urgent"
    ALL = (sprint, urgent)


class TaskRecurrence:
    none = "none"
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"
    ALL = (none, daily, weekly, monthly)


class TaskPipeline:
    backlog = "backlog"
    approved = "approved"
    ALL = (backlog, approved)


class TaskApproval:
    pending = "pending"
    approved = "approved"
    ALL = (pending, approved)


class TaskCreate(BaseModel):
    title: str
    # Sprint keeps estimate+due required; urgent template allows omitting them.
    estimate_minutes: int | None = None
    due_date: Date | None = None
    description: str | None = None
    priority: str = TaskPriority.medium
    task_type: str = TaskType.sprint
    reproduction_steps: str | None = None
    screenshot_url: str | None = None
    recurrence: str = TaskRecurrence.none
    recurrence_until: Date | None = None
    parent_task_id: uuid.UUID | None = None
    repo_name: str | None = None
    # If true, skip backlog gate (manager/supervisor creating ready work).
    auto_approve: bool = False
    # Empty list = needs supervisor/manager assignment (inbox).
    # Multiple ids = one task per person (meeting rule).
    assignee_ids: list[uuid.UUID] = Field(default_factory=list)
    label_ids: list[uuid.UUID] = Field(default_factory=list)

    @field_validator("title")
    @classmethod
    def title_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title is required")
        if len(value) > 255:
            raise ValueError("Title is too long")
        return value

    @field_validator("estimate_minutes")
    @classmethod
    def estimate_ok(cls, value: int | None) -> int | None:
        if value is None:
            return value
        if value < 1:
            raise ValueError("Estimate must be at least 1 minute")
        if value > 60 * 24 * 90:
            raise ValueError("Estimate is too large")
        return value

    @field_validator("priority")
    @classmethod
    def priority_known(cls, value: str) -> str:
        if value not in TaskPriority.ALL:
            raise ValueError("Unknown priority")
        return value

    @field_validator("task_type")
    @classmethod
    def type_known(cls, value: str) -> str:
        if value not in TaskType.ALL:
            raise ValueError("Unknown task type")
        return value

    @field_validator("recurrence")
    @classmethod
    def recurrence_known(cls, value: str) -> str:
        if value not in TaskRecurrence.ALL:
            raise ValueError("Unknown recurrence")
        return value

    @field_validator("screenshot_url")
    @classmethod
    def screenshot_ok(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            return None
        if len(value) > 500:
            raise ValueError("Screenshot URL is too long")
        return value

    @field_validator("repo_name")
    @classmethod
    def repo_ok(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        return value[:200] or None

    @model_validator(mode="after")
    def sprint_requires_estimate_and_due(self) -> "TaskCreate":
        if self.task_type == TaskType.sprint:
            if self.estimate_minutes is None:
                raise ValueError("Estimate is required for sprint tasks")
            if self.due_date is None:
                raise ValueError("Due date is required for sprint tasks")
        return self


class TaskUpdate(BaseModel):
    title: str | None = None
    estimate_minutes: int | None = None
    due_date: Date | None = None
    description: str | None = None
    priority: str | None = None
    task_type: str | None = None
    reproduction_steps: str | None = None
    screenshot_url: str | None = None
    recurrence: str | None = None
    recurrence_until: Date | None = None
    parent_task_id: uuid.UUID | None = None
    repo_name: str | None = None
    assignee_ids: list[uuid.UUID] | None = None
    label_ids: list[uuid.UUID] | None = None

    @field_validator("title")
    @classmethod
    def title_ok(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Title is required")
        if len(value) > 255:
            raise ValueError("Title is too long")
        return value

    @field_validator("estimate_minutes")
    @classmethod
    def estimate_ok(cls, value: int | None) -> int | None:
        if value is None:
            return value
        if value < 1:
            raise ValueError("Estimate must be at least 1 minute")
        if value > 60 * 24 * 90:
            raise ValueError("Estimate is too large")
        return value

    @field_validator("priority")
    @classmethod
    def priority_known(cls, value: str | None) -> str | None:
        if value is not None and value not in TaskPriority.ALL:
            raise ValueError("Unknown priority")
        return value

    @field_validator("task_type")
    @classmethod
    def type_known(cls, value: str | None) -> str | None:
        if value is not None and value not in TaskType.ALL:
            raise ValueError("Unknown task type")
        return value

    @field_validator("recurrence")
    @classmethod
    def recurrence_known(cls, value: str | None) -> str | None:
        if value is not None and value not in TaskRecurrence.ALL:
            raise ValueError("Unknown recurrence")
        return value

    @field_validator("screenshot_url")
    @classmethod
    def screenshot_ok(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            return None
        if len(value) > 500:
            raise ValueError("Screenshot URL is too long")
        return value

    @field_validator("repo_name")
    @classmethod
    def repo_ok(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        return value[:200] or None


class TransitionRequest(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def status_ok(cls, value: str) -> str:
        value = value.strip()
        if not value or len(value) > 64:
            raise ValueError("Invalid status")
        return value


class ApprovalRequest(BaseModel):
    approve: bool = True


class AssigneeRead(BaseModel):
    id: uuid.UUID
    username: str
    full_name: str
    position: int


class LabelRead(BaseModel):
    id: uuid.UUID
    title: str
    color: str


class LabelCreate(BaseModel):
    title: str
    color: str = "#6366f1"

    @field_validator("title")
    @classmethod
    def title_ok(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Label title is required")
        if len(value) > 50:
            raise ValueError("Label title is too long")
        return value

    @field_validator("color")
    @classmethod
    def color_ok(cls, value: str) -> str:
        value = value.strip()
        if not value or len(value) > 20:
            raise ValueError("Invalid label color")
        return value


class LabelUpdate(BaseModel):
    title: str | None = None
    color: str | None = None


class TaskEventRead(BaseModel):
    id: uuid.UUID
    action: str
    detail: str | None = None
    actor_id: uuid.UUID | None = None
    created_at: datetime


class AttachmentRead(BaseModel):
    id: uuid.UUID
    kind: str
    filename: str
    content_type: str | None = None
    size_bytes: int
    url: str
    uploaded_by: uuid.UUID | None = None
    created_at: datetime


class TaskChildBrief(BaseModel):
    id: uuid.UUID
    key: str
    title: str
    status: str
    approval_status: str
    pipeline: str


class TaskRead(BaseModel):
    id: uuid.UUID
    key: str
    local_key: str
    title: str
    description: str | None = None
    estimate_minutes: int | None = None
    due_date: Date | None = None
    priority: str
    task_type: str
    needs_assignment: bool
    pipeline: str = TaskPipeline.backlog
    approval_status: str = TaskApproval.pending
    approved_by: uuid.UUID | None = None
    approved_by_name: str | None = None
    approved_at: datetime | None = None
    parent_task_id: uuid.UUID | None = None
    parent_key: str | None = None
    parent_title: str | None = None
    repo_name: str | None = None
    reproduction_steps: str | None = None
    screenshot_url: str | None = None
    recurrence: str = TaskRecurrence.none
    recurrence_until: Date | None = None
    status: str
    reporter_id: uuid.UUID
    reporter_name: str
    assignees: list[AssigneeRead]
    labels: list[LabelRead]
    attachments: list[AttachmentRead] = Field(default_factory=list)
    children: list[TaskChildBrief] = Field(default_factory=list)
    unmapped_assignee: str | None = None
    source: str
    jira_issue_key: str | None = None
    jira_sync_status: str
    jira_sync_error: str | None = None
    jira_url: str | None = None
    jira_status_id: str | None = None
    jira_status_name: str | None = None
    board_column: str | None = None
    jira_sprint_id: int | None = None
    jira_sprint_name: str | None = None
    jira_last_synced_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    can_edit: bool = False
    can_retry_sync: bool = False
    can_cancel: bool = False
    can_assign: bool = False
    can_approve: bool = False


class TaskDetail(TaskRead):
    events: list[TaskEventRead] = Field(default_factory=list)


class TaskCreateResult(BaseModel):
    tasks: list[TaskDetail]


class UserBrief(BaseModel):
    id: uuid.UUID
    username: str
    full_name: str
    role: str


class JiraConnectionWrite(BaseModel):
    base_url: str
    auth_type: str = "bearer"
    username: str | None = None
    secret: str | None = None
    default_project_key: str = ""
    default_issuetype_name: str = "Task"
    default_issuetype_id: str | None = None
    board_id: int | None = None
    board_name: str | None = None
    owner_manager_id: uuid.UUID | None = None
    status_map: dict[str, list[str]] | None = None

    @field_validator("base_url")
    @classmethod
    def url_ok(cls, value: str) -> str:
        value = value.strip().rstrip("/")
        if not value.startswith("http://") and not value.startswith("https://"):
            raise ValueError("Jira URL must start with http:// or https://")
        return value

    @field_validator("auth_type")
    @classmethod
    def auth_ok(cls, value: str) -> str:
        if value not in {"bearer", "basic"}:
            raise ValueError("auth_type must be bearer or basic")
        return value

    @field_validator("default_project_key")
    @classmethod
    def project_ok(cls, value: str) -> str:
        # Empty allowed for "test/load projects"; save() still requires a real key.
        value = (value or "").strip().upper()
        if not value:
            return ""
        if not re.fullmatch(r"[A-Z][A-Z0-9]+", value):
            raise ValueError("Project key must be letters and digits")
        return value


class JiraConnectionRead(BaseModel):
    base_url: str
    auth_type: str
    username: str | None = None
    has_secret: bool
    default_project_key: str
    default_issuetype_name: str
    default_issuetype_id: str | None = None
    board_id: int | None = None
    board_name: str | None = None
    board_columns: list[dict] = Field(default_factory=list)
    owner_manager_id: uuid.UUID | None = None
    status_map: dict[str, list[str]]
    webhook_secret: str
    webhook_url: str
    last_polled_at: datetime | None = None
    error_count: int = 0
    configured: bool = True


class JiraStatusMapWrite(BaseModel):
    status_map: dict[str, list[str]] = Field(default_factory=lambda: {k: list(v) for k, v in DEFAULT_STATUS_MAP.items()})


class UserMapItem(BaseModel):
    jira_username: str
    jira_display_name: str | None = None
    jira_email: str | None = None
    remo_user_id: uuid.UUID | None = None

    @field_validator("jira_username")
    @classmethod
    def username_ok(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Jira username is required")
        return value


class UserMapWrite(BaseModel):
    items: list[UserMapItem]


class UserMapRead(BaseModel):
    id: uuid.UUID
    jira_username: str
    jira_display_name: str | None = None
    jira_email: str | None = None
    remo_user_id: uuid.UUID | None = None


class SyncJobRead(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID | None = None
    job_type: str
    status: str
    attempts: int
    error: str | None = None
    detail: str | None = None
    created_at: datetime
    updated_at: datetime


class WebhookRegisterRequest(BaseModel):
    callback_url: str | None = None


class JiraPersonPreview(BaseModel):
    jira_username: str
    jira_display_name: str | None = None
    jira_email: str | None = None
    active: bool = True
    status: str  # mapped | unmatched | conflict
    remo_user_id: uuid.UUID | None = None
    remo_full_name: str | None = None
    remo_username: str | None = None
    suggested_username: str | None = None


class JiraPeopleImportItem(BaseModel):
    jira_username: str
    jira_display_name: str | None = None
    jira_email: str | None = None
    role: str = "MEMBER"
    supervisor_id: uuid.UUID | None = None
    remo_user_id: uuid.UUID | None = None  # link existing instead of create


class JiraPeopleImportRequest(BaseModel):
    people: list[JiraPeopleImportItem]
    default_role: str = "MEMBER"
    default_supervisor_id: uuid.UUID | None = None


class JiraPeopleImportResultItem(BaseModel):
    jira_username: str
    action: str  # created | linked | skipped
    remo_user_id: uuid.UUID | None = None
    remo_username: str | None = None
    temporary_password: str | None = None
    detail: str | None = None


class JiraPeopleImportResult(BaseModel):
    imported: list[JiraPeopleImportResultItem]
    created_count: int
    linked_count: int
    skipped_count: int

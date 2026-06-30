import uuid
from datetime import date as Date, datetime
from enum import Enum
from pydantic import BaseModel


class DayType(str, Enum):
    REMOTE = "REMOTE"
    LEAVE = "LEAVE"


class ApprovalStatus(str, Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class DayEntryUpsert(BaseModel):
    day_type: DayType


class DayNotesUpdate(BaseModel):
    notes: str | None = None


class ApprovalRequest(BaseModel):
    status: ApprovalStatus
    approved_minutes: int | None = None  # None = approve all hours


class DayEntryRead(BaseModel):
    user_id: uuid.UUID
    date: Date
    day_type: DayType
    set_by: uuid.UUID | None = None
    notes: str | None = None
    approval_status: str | None = None
    approved_by: uuid.UUID | None = None
    approved_minutes: int | None = None
    approved_at: datetime | None = None

    model_config = {"from_attributes": True}


class DayStatsRead(BaseModel):
    date: Date
    day_type: DayType | None = None
    total_work_minutes: int
    focus_minutes: int
    break_minutes: int
    meeting_minutes: int
    approval_status: str | None = None
    approved_by: uuid.UUID | None = None
    approved_minutes: int | None = None

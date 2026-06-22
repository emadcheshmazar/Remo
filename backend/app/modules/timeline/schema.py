import uuid
from datetime import datetime
from enum import Enum
from pydantic import BaseModel


class EventType(str, Enum):
    SESSION_START = "SESSION_START"
    SESSION_END = "SESSION_END"
    STATUS_CHANGE = "STATUS_CHANGE"
    REPORT_SUBMITTED = "REPORT_SUBMITTED"


class TimelineEventRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    event_type: EventType
    payload: dict
    occurred_at: datetime

    model_config = {"from_attributes": True}

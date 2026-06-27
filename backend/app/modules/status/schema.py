import uuid
from datetime import datetime
from enum import Enum
from pydantic import BaseModel


class StatusState(str, Enum):
    AVAILABLE = "AVAILABLE"
    OFFLINE = "OFFLINE"
    BREAK = "BREAK"
    FOCUS = "FOCUS"
    MEETING = "MEETING"


class StatusRead(BaseModel):
    user_id: uuid.UUID
    status: StatusState
    updated_at: datetime

    model_config = {"from_attributes": True}


class ActivityTag(str, Enum):
    FOCUS = "FOCUS"
    BREAK = "BREAK"
    MEETING = "MEETING"


class StatusUpdate(BaseModel):
    tag: ActivityTag | None = None


class StatusLogRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    status: StatusState
    changed_at: datetime

    model_config = {"from_attributes": True}


class PingRequest(BaseModel):
    message: str = ""


class PingRespondRequest(BaseModel):
    from_user_id: str
    reply_message: str = ""

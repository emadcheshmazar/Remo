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


class StatusUpdate(BaseModel):
    status: StatusState


class StatusLogRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    status: StatusState
    changed_at: datetime

    model_config = {"from_attributes": True}

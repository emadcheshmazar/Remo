import uuid
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel


class WorkSessionRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    date: date
    started_at: datetime
    ended_at: Optional[datetime]
    duration_minutes: Optional[int]

    model_config = {"from_attributes": True}


class WorkSummary(BaseModel):
    is_active: bool
    session: Optional[WorkSessionRead]
    total_minutes_today: int

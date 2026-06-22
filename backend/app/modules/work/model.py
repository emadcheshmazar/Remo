import uuid
from datetime import datetime, date as Date
from typing import Optional
from sqlmodel import SQLModel, Field


class WorkSession(SQLModel, table=True):
    __tablename__ = "work_sessions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    date: Date = Field(index=True)
    started_at: datetime
    ended_at: Optional[datetime] = Field(default=None)
    duration_minutes: Optional[int] = Field(default=None)

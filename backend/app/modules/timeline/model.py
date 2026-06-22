import uuid
from datetime import datetime
from sqlalchemy import Column
from sqlalchemy.types import JSON
from sqlmodel import SQLModel, Field


class TimelineEvent(SQLModel, table=True):
    __tablename__ = "timeline_events"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    event_type: str
    payload: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    occurred_at: datetime

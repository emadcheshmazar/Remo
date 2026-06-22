import uuid
from datetime import datetime
import sqlalchemy as sa
from sqlalchemy.types import JSON
from sqlmodel import SQLModel, Field


class TimelineEvent(SQLModel, table=True):
    __tablename__ = "timeline_events"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    event_type: str
    payload: dict = Field(default_factory=dict, sa_column=sa.Column(JSON, nullable=False))
    occurred_at: datetime = Field(sa_column=sa.Column(sa.DateTime(timezone=True), nullable=False))

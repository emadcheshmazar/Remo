import uuid
from datetime import datetime, date as Date
from typing import Optional
import sqlalchemy as sa
from sqlmodel import SQLModel, Field


class WorkSession(SQLModel, table=True):
    __tablename__ = "work_sessions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    date: Date = Field(index=True)
    started_at: datetime = Field(sa_column=sa.Column(sa.DateTime(timezone=True), nullable=False))
    ended_at: Optional[datetime] = Field(
        default=None,
        sa_column=sa.Column(sa.DateTime(timezone=True), nullable=True),
    )
    duration_minutes: Optional[int] = Field(default=None)

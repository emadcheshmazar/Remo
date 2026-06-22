import uuid
from datetime import datetime
from sqlmodel import SQLModel, Field


class UserStatus(SQLModel, table=True):
    __tablename__ = "user_statuses"

    user_id: uuid.UUID = Field(primary_key=True, foreign_key="users.id")
    status: str
    updated_at: datetime


class StatusLog(SQLModel, table=True):
    __tablename__ = "status_logs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    status: str
    changed_at: datetime

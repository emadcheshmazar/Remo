import uuid
from datetime import datetime, date as Date
import sqlalchemy as sa
from sqlmodel import SQLModel, Field


class DailyReport(SQLModel, table=True):
    __tablename__ = "daily_reports"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    date: Date = Field(index=True)
    today_text: str = Field(default="")
    blockers_text: str = Field(default="")
    tomorrow_text: str = Field(default="")
    updated_at: datetime = Field(sa_column=sa.Column(sa.DateTime(timezone=True), nullable=False))

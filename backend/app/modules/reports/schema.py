import uuid
from datetime import datetime, date
from pydantic import BaseModel


class ReportUpsert(BaseModel):
    today_text: str = ""
    blockers_text: str = ""
    tomorrow_text: str = ""


class ReportRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    date: date
    today_text: str
    blockers_text: str
    tomorrow_text: str
    updated_at: datetime

    model_config = {"from_attributes": True}

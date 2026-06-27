import uuid
from datetime import datetime, timezone
from app.modules.timeline.model import TimelineEvent
from app.modules.timeline.repository import TimelineRepository


class TimelineService:
    def __init__(self, repo: TimelineRepository):
        self.repo = repo

    async def add_event(
        self, user_id: uuid.UUID, event_type: str, payload: dict | None = None
    ) -> TimelineEvent:
        event = TimelineEvent(
            user_id=user_id,
            event_type=event_type,
            payload=payload or {},
            occurred_at=datetime.now(timezone.utc),
        )
        return await self.repo.add(event)

    async def get_timeline(self, user_id: uuid.UUID) -> list[TimelineEvent]:
        return await self.repo.list_by_user(user_id)

    async def get_today(self, user_id: uuid.UUID) -> list[TimelineEvent]:
        today = datetime.now(timezone.utc).date()
        return await self.repo.list_by_user_today(user_id, today)

    async def get_by_date(self, user_id: uuid.UUID, day) -> list[TimelineEvent]:
        return await self.repo.list_by_user_today(user_id, day)

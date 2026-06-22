import uuid
from datetime import date as Date
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.timeline.model import TimelineEvent


class TimelineRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def add(self, event: TimelineEvent) -> TimelineEvent:
        self.session.add(event)
        await self.session.commit()
        await self.session.refresh(event)
        return event

    async def list_by_user(self, user_id: uuid.UUID, limit: int = 50) -> list[TimelineEvent]:
        result = await self.session.execute(
            select(TimelineEvent)
            .where(TimelineEvent.user_id == user_id)
            .order_by(TimelineEvent.occurred_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def list_by_user_today(self, user_id: uuid.UUID, today: Date) -> list[TimelineEvent]:
        result = await self.session.execute(
            select(TimelineEvent)
            .where(
                and_(
                    TimelineEvent.user_id == user_id,
                    func.date(TimelineEvent.occurred_at) == today,
                )
            )
            .order_by(TimelineEvent.occurred_at.asc())
        )
        return list(result.scalars().all())

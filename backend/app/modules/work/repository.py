import uuid
from datetime import date as Date
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.work.model import WorkSession


class WorkRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_active(self, user_id: uuid.UUID) -> WorkSession | None:
        result = await self.session.execute(
            select(WorkSession).where(
                and_(WorkSession.user_id == user_id, WorkSession.ended_at.is_(None))
            )
        )
        return result.scalar_one_or_none()

    async def get_by_date(self, user_id: uuid.UUID, day: Date) -> list[WorkSession]:
        result = await self.session.execute(
            select(WorkSession)
            .where(and_(WorkSession.user_id == user_id, WorkSession.date == day))
            .order_by(WorkSession.started_at)
        )
        return list(result.scalars().all())

    async def get_history(self, user_id: uuid.UUID, limit: int = 50) -> list[WorkSession]:
        result = await self.session.execute(
            select(WorkSession)
            .where(WorkSession.user_id == user_id)
            .order_by(WorkSession.started_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def create(self, work_session: WorkSession) -> WorkSession:
        self.session.add(work_session)
        await self.session.commit()
        await self.session.refresh(work_session)
        return work_session

    async def update(self, work_session: WorkSession) -> WorkSession:
        self.session.add(work_session)
        await self.session.commit()
        await self.session.refresh(work_session)
        return work_session

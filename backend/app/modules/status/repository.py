import uuid
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.status.model import UserStatus, StatusLog


class StatusRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, user_id: uuid.UUID) -> UserStatus | None:
        result = await self.session.execute(
            select(UserStatus).where(UserStatus.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_all(self) -> list[UserStatus]:
        result = await self.session.execute(select(UserStatus))
        return list(result.scalars().all())

    async def upsert(self, user_id: uuid.UUID, status: str, now: datetime) -> UserStatus:
        existing = await self.get(user_id)
        if existing:
            existing.status = status
            existing.updated_at = now
            self.session.add(existing)
            await self.session.commit()
            await self.session.refresh(existing)
            return existing
        new = UserStatus(user_id=user_id, status=status, updated_at=now)
        self.session.add(new)
        await self.session.commit()
        await self.session.refresh(new)
        return new

    async def add_log(self, user_id: uuid.UUID, status: str, now: datetime) -> None:
        log = StatusLog(user_id=user_id, status=status, changed_at=now)
        self.session.add(log)
        await self.session.commit()

    async def get_log(self, user_id: uuid.UUID, limit: int = 50) -> list[StatusLog]:
        result = await self.session.execute(
            select(StatusLog)
            .where(StatusLog.user_id == user_id)
            .order_by(StatusLog.changed_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

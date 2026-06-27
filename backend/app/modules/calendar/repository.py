import uuid
from datetime import date as Date, datetime, timezone
from sqlalchemy import select, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.calendar.model import DayEntry


class CalendarRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, user_id: uuid.UUID, day: Date) -> DayEntry | None:
        result = await self.session.execute(
            select(DayEntry).where(and_(DayEntry.user_id == user_id, DayEntry.date == day))
        )
        return result.scalar_one_or_none()

    async def get_range(self, user_id: uuid.UUID, start: Date, end: Date) -> list[DayEntry]:
        result = await self.session.execute(
            select(DayEntry).where(
                and_(
                    DayEntry.user_id == user_id,
                    DayEntry.date >= start,
                    DayEntry.date <= end,
                )
            ).order_by(DayEntry.date)
        )
        return list(result.scalars().all())

    async def get_team_range(
        self, user_ids: list[uuid.UUID], start: Date, end: Date
    ) -> list[DayEntry]:
        if not user_ids:
            return []
        result = await self.session.execute(
            select(DayEntry).where(
                and_(
                    DayEntry.user_id.in_(user_ids),
                    DayEntry.date >= start,
                    DayEntry.date <= end,
                )
            ).order_by(DayEntry.date)
        )
        return list(result.scalars().all())

    async def upsert(
        self, user_id: uuid.UUID, day: Date, day_type: str, set_by: uuid.UUID
    ) -> DayEntry:
        existing = await self.get(user_id, day)
        if existing:
            existing.day_type = day_type
            existing.set_by = set_by
            self.session.add(existing)
            await self.session.commit()
            await self.session.refresh(existing)
            return existing
        entry = DayEntry(user_id=user_id, date=day, day_type=day_type, set_by=set_by)
        self.session.add(entry)
        await self.session.commit()
        await self.session.refresh(entry)
        return entry

    async def clear_approval(self, user_id: uuid.UUID, day: Date) -> DayEntry | None:
        existing = await self.get(user_id, day)
        if not existing:
            return None
        existing.approval_status = None
        existing.approved_by = None
        existing.approved_minutes = None
        existing.approved_at = None
        self.session.add(existing)
        await self.session.commit()
        await self.session.refresh(existing)
        return existing

    async def upsert_approval(
        self,
        user_id: uuid.UUID,
        day: Date,
        approved_by: uuid.UUID,
        approval_status: str,
        approved_minutes: int | None,
    ) -> DayEntry | None:
        existing = await self.get(user_id, day)
        if not existing:
            return None
        existing.approval_status = approval_status
        existing.approved_by = approved_by
        existing.approved_minutes = approved_minutes
        existing.approved_at = datetime.now(timezone.utc)
        self.session.add(existing)
        await self.session.commit()
        await self.session.refresh(existing)
        return existing

    async def delete(self, user_id: uuid.UUID, day: Date) -> bool:
        result = await self.session.execute(
            delete(DayEntry).where(and_(DayEntry.user_id == user_id, DayEntry.date == day))
        )
        await self.session.commit()
        return result.rowcount > 0

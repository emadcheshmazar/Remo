import uuid
from datetime import date as Date
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.reports.model import DailyReport


class ReportRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_date(self, user_id: uuid.UUID, day: Date) -> DailyReport | None:
        result = await self.session.execute(
            select(DailyReport).where(
                and_(DailyReport.user_id == user_id, DailyReport.date == day)
            )
        )
        return result.scalar_one_or_none()

    async def list_by_user(self, user_id: uuid.UUID, limit: int = 30) -> list[DailyReport]:
        result = await self.session.execute(
            select(DailyReport)
            .where(DailyReport.user_id == user_id)
            .order_by(DailyReport.date.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def create(self, report: DailyReport) -> DailyReport:
        self.session.add(report)
        await self.session.commit()
        await self.session.refresh(report)
        return report

    async def update(self, report: DailyReport) -> DailyReport:
        self.session.add(report)
        await self.session.commit()
        await self.session.refresh(report)
        return report

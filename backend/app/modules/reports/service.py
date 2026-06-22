import uuid
from datetime import datetime, timezone
from app.modules.reports.model import DailyReport
from app.modules.reports.schema import ReportUpsert
from app.modules.reports.repository import ReportRepository


class ReportService:
    def __init__(self, repo: ReportRepository):
        self.repo = repo

    async def get_today(self, user_id: uuid.UUID) -> DailyReport | None:
        today = datetime.now(timezone.utc).date()
        return await self.repo.get_by_date(user_id, today)

    async def upsert_today(self, user_id: uuid.UUID, data: ReportUpsert) -> DailyReport:
        now = datetime.now(timezone.utc)
        today = now.date()
        existing = await self.repo.get_by_date(user_id, today)
        if existing:
            existing.today_text = data.today_text
            existing.blockers_text = data.blockers_text
            existing.tomorrow_text = data.tomorrow_text
            existing.updated_at = now
            return await self.repo.update(existing)
        return await self.repo.create(
            DailyReport(
                user_id=user_id,
                date=today,
                today_text=data.today_text,
                blockers_text=data.blockers_text,
                tomorrow_text=data.tomorrow_text,
                updated_at=now,
            )
        )

    async def list_by_user(self, user_id: uuid.UUID) -> list[DailyReport]:
        return await self.repo.list_by_user(user_id)

    async def get_by_date(self, user_id: uuid.UUID, day: str) -> DailyReport | None:
        from datetime import date
        return await self.repo.get_by_date(user_id, date.fromisoformat(day))

import uuid
from datetime import datetime, timezone
from math import floor
from fastapi import HTTPException, status
from app.modules.work.model import WorkSession
from app.modules.work.repository import WorkRepository


class WorkService:
    def __init__(self, repo: WorkRepository):
        self.repo = repo

    async def start_session(self, user_id: uuid.UUID) -> WorkSession:
        if await self.repo.get_active(user_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A work session is already active",
            )
        now = datetime.now(timezone.utc)
        return await self.repo.create(
            WorkSession(user_id=user_id, date=now.date(), started_at=now)
        )

    async def end_session(self, user_id: uuid.UUID) -> WorkSession:
        active = await self.repo.get_active(user_id)
        if not active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active work session",
            )
        now = datetime.now(timezone.utc)
        active.ended_at = now
        active.duration_minutes = floor(
            (now - active.started_at).total_seconds() / 60
        )
        return await self.repo.update(active)

    async def get_active(self, user_id: uuid.UUID) -> WorkSession | None:
        return await self.repo.get_active(user_id)

    async def get_today_summary(self, user_id: uuid.UUID) -> dict:
        today = datetime.now(timezone.utc).date()
        sessions = await self.repo.get_by_date(user_id, today)
        active = next((s for s in sessions if s.ended_at is None), None)
        total = sum(s.duration_minutes or 0 for s in sessions if s.ended_at is not None)
        return {"is_active": active is not None, "session": active, "total_minutes_today": total}

    async def get_history(self, user_id: uuid.UUID) -> list[WorkSession]:
        return await self.repo.get_history(user_id)

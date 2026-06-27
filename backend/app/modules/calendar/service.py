import uuid
from datetime import date as Date, datetime, timezone
from fastapi import HTTPException, status
from app.modules.calendar.repository import CalendarRepository
from app.modules.calendar.model import DayEntry
from app.modules.work.repository import WorkRepository
from app.modules.timeline.repository import TimelineRepository
from app.modules.users.repository import UserRepository


class CalendarService:
    def __init__(
        self,
        repo: CalendarRepository,
        work_repo: WorkRepository,
        timeline_repo: TimelineRepository,
        user_repo: UserRepository | None = None,
    ):
        self.repo = repo
        self.work_repo = work_repo
        self.timeline_repo = timeline_repo
        self.user_repo = user_repo

    async def get_today_entry(self, user_id: uuid.UUID) -> DayEntry | None:
        today = datetime.now(timezone.utc).date()
        return await self.repo.get(user_id, today)

    async def get_month(self, user_id: uuid.UUID, start: Date, end: Date) -> list[DayEntry]:
        return await self.repo.get_range(user_id, start, end)

    async def get_team_month(
        self, user_ids: list[uuid.UUID], start: Date, end: Date
    ) -> list[DayEntry]:
        return await self.repo.get_team_range(user_ids, start, end)

    def _check_can_edit(self, actor_id: uuid.UUID, actor_role: str) -> None:
        if actor_role == "MEMBER":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Members cannot set day types")

    async def _check_supervisor_scope(self, actor_id: uuid.UUID, user_id: uuid.UUID) -> None:
        if actor_id == user_id:
            return
        if self.user_repo is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        target = await self.user_repo.get_by_id(user_id)
        if target is None or target.supervisor_id != actor_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only modify day types for your direct members")

    async def set_day(
        self,
        actor_id: uuid.UUID,
        actor_role: str,
        user_id: uuid.UUID,
        day: Date,
        day_type: str,
    ) -> DayEntry:
        self._check_can_edit(actor_id, actor_role)
        if actor_role == "SUPERVISOR":
            await self._check_supervisor_scope(actor_id, user_id)
        return await self.repo.upsert(user_id, day, day_type, actor_id)

    async def clear_day(
        self,
        actor_id: uuid.UUID,
        actor_role: str,
        user_id: uuid.UUID,
        day: Date,
    ) -> None:
        self._check_can_edit(actor_id, actor_role)
        if actor_role == "SUPERVISOR":
            await self._check_supervisor_scope(actor_id, user_id)
        await self.repo.delete(user_id, day)

    async def approve_day(
        self,
        actor_id: uuid.UUID,
        actor_role: str,
        user_id: uuid.UUID,
        day: Date,
        approval_status: str,
        approved_minutes: int | None,
    ) -> DayEntry:
        if actor_role in ("MEMBER", "MANAGER"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only supervisors can approve work")
        await self._check_supervisor_scope(actor_id, user_id)

        entry = await self.repo.upsert_approval(user_id, day, actor_id, approval_status, approved_minutes)
        if entry is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Day entry not found")
        return entry

    async def clear_approval(
        self,
        actor_id: uuid.UUID,
        actor_role: str,
        user_id: uuid.UUID,
        day: Date,
    ) -> DayEntry:
        if actor_role in ("MEMBER", "MANAGER"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only supervisors can clear approvals")
        await self._check_supervisor_scope(actor_id, user_id)
        entry = await self.repo.clear_approval(user_id, day)
        if entry is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Day entry not found")
        return entry

    async def get_day_stats(self, user_id: uuid.UUID, day: Date) -> dict:
        sessions = await self.work_repo.get_by_date(user_id, day)
        total_work = sum(s.duration_minutes or 0 for s in sessions if s.ended_at is not None)

        events = await self.timeline_repo.list_by_user_today(user_id, day)
        events_sorted = sorted(events, key=lambda e: e.occurred_at)

        focus_m = break_m = meeting_m = 0
        current_tag: str | None = None
        tag_start: datetime | None = None

        for event in events_sorted:
            et = event.event_type
            if et == "SESSION_START":
                current_tag = None
                tag_start = event.occurred_at
            elif et == "STATUS_CHANGE":
                to_status = (event.payload or {}).get("to", "AVAILABLE")
                if tag_start and current_tag in ("FOCUS", "BREAK", "MEETING"):
                    dur = int((event.occurred_at - tag_start).total_seconds() / 60)
                    if current_tag == "FOCUS": focus_m += dur
                    elif current_tag == "BREAK": break_m += dur
                    elif current_tag == "MEETING": meeting_m += dur
                current_tag = to_status if to_status in ("FOCUS", "BREAK", "MEETING") else None
                tag_start = event.occurred_at
            elif et == "SESSION_END":
                if tag_start and current_tag in ("FOCUS", "BREAK", "MEETING"):
                    dur = int((event.occurred_at - tag_start).total_seconds() / 60)
                    if current_tag == "FOCUS": focus_m += dur
                    elif current_tag == "BREAK": break_m += dur
                    elif current_tag == "MEETING": meeting_m += dur
                current_tag = None
                tag_start = None

        day_entry = await self.repo.get(user_id, day)
        return {
            "date": day,
            "day_type": day_entry.day_type if day_entry else None,
            "total_work_minutes": total_work,
            "focus_minutes": focus_m,
            "break_minutes": break_m,
            "meeting_minutes": meeting_m,
            "approval_status": day_entry.approval_status if day_entry else None,
            "approved_by": day_entry.approved_by if day_entry else None,
            "approved_minutes": day_entry.approved_minutes if day_entry else None,
        }

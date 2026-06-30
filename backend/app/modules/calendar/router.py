import uuid
from datetime import date as Date, datetime, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.shared.dependencies import get_current_user
from app.modules.calendar.schema import DayEntryRead, DayEntryUpsert, DayNotesUpdate, DayStatsRead, ApprovalRequest
from app.modules.calendar.service import CalendarService
from app.modules.calendar.repository import CalendarRepository
from app.modules.work.repository import WorkRepository
from app.modules.timeline.repository import TimelineRepository
from app.modules.users.repository import UserRepository
from app.modules.users.service import UserService
from app.modules.users.schema import UserRead

router = APIRouter(prefix="/calendar", tags=["calendar"])


def _svc(session: AsyncSession = Depends(get_session)) -> CalendarService:
    return CalendarService(
        CalendarRepository(session),
        WorkRepository(session),
        TimelineRepository(session),
        UserRepository(session),
    )


def _user_svc(session: AsyncSession = Depends(get_session)) -> UserService:
    return UserService(UserRepository(session))


@router.get("/me/today", response_model=DayEntryRead | None)
async def get_my_today(
    current_user: dict = Depends(get_current_user),
    svc: CalendarService = Depends(_svc),
):
    return await svc.get_today_entry(uuid.UUID(current_user["sub"]))


@router.get("/team-users", response_model=list[UserRead])
async def get_calendar_users(
    current_user: dict = Depends(get_current_user),
    user_svc: UserService = Depends(_user_svc),
):
    actor_id = uuid.UUID(current_user["sub"])
    actor_role = current_user["role"]
    return await user_svc.list_users_for_calendar(actor_id, actor_role)


@router.get("/team", response_model=list[DayEntryRead])
async def get_team_calendar(
    start: Date = Query(...),
    end: Date = Query(...),
    current_user: dict = Depends(get_current_user),
    svc: CalendarService = Depends(_svc),
    user_svc: UserService = Depends(_user_svc),
):
    actor_id = uuid.UUID(current_user["sub"])
    actor_role = current_user["role"]
    users = await user_svc.list_users_for_calendar(actor_id, actor_role)
    user_ids = list({u.id for u in users} | {actor_id})
    return await svc.get_team_month(user_ids, start, end)


@router.get("/{user_id}/stats", response_model=DayStatsRead)
async def get_day_stats(
    user_id: uuid.UUID,
    date: Date = Query(...),
    current_user: dict = Depends(get_current_user),
    svc: CalendarService = Depends(_svc),
):
    return await svc.get_day_stats(user_id, date)


@router.get("/{user_id}", response_model=list[DayEntryRead])
async def get_user_calendar(
    user_id: uuid.UUID,
    start: Date = Query(...),
    end: Date = Query(...),
    current_user: dict = Depends(get_current_user),
    svc: CalendarService = Depends(_svc),
):
    return await svc.get_month(user_id, start, end)


@router.put("/{user_id}/{date}", response_model=DayEntryRead)
async def set_day_entry(
    user_id: uuid.UUID,
    date: Date,
    body: DayEntryUpsert,
    current_user: dict = Depends(get_current_user),
    svc: CalendarService = Depends(_svc),
):
    actor_id = uuid.UUID(current_user["sub"])
    return await svc.set_day(actor_id, current_user["role"], user_id, date, body.day_type.value)


@router.patch("/{user_id}/{date}/notes", response_model=DayEntryRead)
async def set_day_notes(
    user_id: uuid.UUID,
    date: Date,
    body: DayNotesUpdate,
    current_user: dict = Depends(get_current_user),
    svc: CalendarService = Depends(_svc),
):
    actor_id = uuid.UUID(current_user["sub"])
    return await svc.set_notes(actor_id, current_user["role"], user_id, date, body.notes)


@router.post("/{user_id}/{date}/approve", response_model=DayEntryRead)
async def approve_day_entry(
    user_id: uuid.UUID,
    date: Date,
    body: ApprovalRequest,
    current_user: dict = Depends(get_current_user),
    svc: CalendarService = Depends(_svc),
):
    actor_id = uuid.UUID(current_user["sub"])
    return await svc.approve_day(
        actor_id, current_user["role"], user_id, date,
        body.status.value, body.approved_minutes
    )


@router.delete("/{user_id}/{date}/approve", response_model=DayEntryRead)
async def clear_approval(
    user_id: uuid.UUID,
    date: Date,
    current_user: dict = Depends(get_current_user),
    svc: CalendarService = Depends(_svc),
):
    actor_id = uuid.UUID(current_user["sub"])
    return await svc.clear_approval(actor_id, current_user["role"], user_id, date)


@router.delete("/{user_id}/{date}", status_code=204)
async def clear_day_entry(
    user_id: uuid.UUID,
    date: Date,
    current_user: dict = Depends(get_current_user),
    svc: CalendarService = Depends(_svc),
):
    actor_id = uuid.UUID(current_user["sub"])
    await svc.clear_day(actor_id, current_user["role"], user_id, date)

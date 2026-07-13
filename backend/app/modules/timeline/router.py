import uuid
from datetime import date as Date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.shared.dependencies import get_current_user
from app.shared.scope import resolve_owned_user
from app.modules.timeline.schema import TimelineEventRead
from app.modules.timeline.service import TimelineService
from app.modules.timeline.repository import TimelineRepository
from app.modules.users.repository import UserRepository

router = APIRouter(prefix="/timeline", tags=["timeline"])


def _service(session: AsyncSession = Depends(get_session)) -> TimelineService:
    return TimelineService(TimelineRepository(session))


def _user_repo(session: AsyncSession = Depends(get_session)) -> UserRepository:
    return UserRepository(session)


@router.get("/me", response_model=list[TimelineEventRead])
async def get_my_timeline(
    current_user: dict = Depends(get_current_user),
    service: TimelineService = Depends(_service),
):
    return await service.get_timeline(uuid.UUID(current_user["sub"]))


@router.get("/me/today", response_model=list[TimelineEventRead])
async def get_my_today(
    current_user: dict = Depends(get_current_user),
    service: TimelineService = Depends(_service),
):
    return await service.get_today(uuid.UUID(current_user["sub"]))


@router.get("/{user_id}/by-date", response_model=list[TimelineEventRead])
async def get_user_timeline_by_date(
    user_id: uuid.UUID,
    date: Date = Query(...),
    current_user: dict = Depends(get_current_user),
    service: TimelineService = Depends(_service),
    user_repo: UserRepository = Depends(_user_repo),
):
    actor_id = uuid.UUID(current_user["sub"])
    await resolve_owned_user(user_repo, actor_id, current_user["role"], user_id)
    return await service.get_by_date(user_id, date)


@router.get("/{user_id}", response_model=list[TimelineEventRead])
async def get_user_timeline(
    user_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    service: TimelineService = Depends(_service),
    user_repo: UserRepository = Depends(_user_repo),
):
    actor_id = uuid.UUID(current_user["sub"])
    await resolve_owned_user(user_repo, actor_id, current_user["role"], user_id)
    return await service.get_timeline(user_id)

import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.shared.dependencies import get_current_user
from app.shared.roles import MANAGEABLE_ROLES
from app.modules.timeline.schema import TimelineEventRead
from app.modules.timeline.service import TimelineService
from app.modules.timeline.repository import TimelineRepository

router = APIRouter(prefix="/timeline", tags=["timeline"])


def _service(session: AsyncSession = Depends(get_session)) -> TimelineService:
    return TimelineService(TimelineRepository(session))


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


@router.get("/{user_id}", response_model=list[TimelineEventRead])
async def get_user_timeline(
    user_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    service: TimelineService = Depends(_service),
):
    if str(user_id) == current_user["sub"]:
        return await service.get_timeline(user_id)
    if not MANAGEABLE_ROLES.get(current_user["role"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return await service.get_timeline(user_id)

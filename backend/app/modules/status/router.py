import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.shared.dependencies import get_current_user
from app.modules.status.schema import StatusRead, StatusUpdate, StatusLogRead
from app.modules.status.service import StatusService
from app.modules.status.repository import StatusRepository
from app.modules.timeline.service import TimelineService
from app.modules.timeline.repository import TimelineRepository

router = APIRouter(prefix="/status", tags=["status"])


def _service(session: AsyncSession = Depends(get_session)) -> StatusService:
    return StatusService(StatusRepository(session))


def _timeline(session: AsyncSession = Depends(get_session)) -> TimelineService:
    return TimelineService(TimelineRepository(session))


@router.get("/me", response_model=StatusRead | None)
async def get_my_status(
    current_user: dict = Depends(get_current_user),
    service: StatusService = Depends(_service),
):
    return await service.get_my_status(uuid.UUID(current_user["sub"]))


@router.patch("/me", response_model=StatusRead)
async def update_my_status(
    data: StatusUpdate,
    current_user: dict = Depends(get_current_user),
    service: StatusService = Depends(_service),
    timeline: TimelineService = Depends(_timeline),
):
    user_id = uuid.UUID(current_user["sub"])
    result = await service.update_status(user_id, data.status)
    await timeline.add_event(user_id, "STATUS_CHANGE", {"to": data.status})
    return result


@router.get("", response_model=list[StatusRead])
async def get_all_statuses(
    current_user: dict = Depends(get_current_user),
    service: StatusService = Depends(_service),
):
    return await service.get_all()


@router.get("/{user_id}/log", response_model=list[StatusLogRead])
async def get_status_log(
    user_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    service: StatusService = Depends(_service),
):
    return await service.get_log(user_id)

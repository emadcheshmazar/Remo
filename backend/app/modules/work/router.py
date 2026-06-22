import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.shared.dependencies import get_current_user
from app.shared.roles import MANAGEABLE_ROLES
from app.modules.work.schema import WorkSessionRead, WorkSummary
from app.modules.work.service import WorkService
from app.modules.work.repository import WorkRepository

router = APIRouter(prefix="/work", tags=["work"])


def _service(session: AsyncSession = Depends(get_session)) -> WorkService:
    return WorkService(WorkRepository(session))


@router.post("/start", response_model=WorkSessionRead, status_code=201)
async def start_session(
    current_user: dict = Depends(get_current_user),
    service: WorkService = Depends(_service),
):
    return await service.start_session(uuid.UUID(current_user["sub"]))


@router.post("/end", response_model=WorkSessionRead)
async def end_session(
    current_user: dict = Depends(get_current_user),
    service: WorkService = Depends(_service),
):
    return await service.end_session(uuid.UUID(current_user["sub"]))


@router.get("/current", response_model=WorkSessionRead | None)
async def get_current(
    current_user: dict = Depends(get_current_user),
    service: WorkService = Depends(_service),
):
    return await service.get_active(uuid.UUID(current_user["sub"]))


@router.get("/summary", response_model=WorkSummary)
async def get_summary(
    current_user: dict = Depends(get_current_user),
    service: WorkService = Depends(_service),
):
    return await service.get_today_summary(uuid.UUID(current_user["sub"]))


@router.get("/history", response_model=list[WorkSessionRead])
async def get_history(
    current_user: dict = Depends(get_current_user),
    service: WorkService = Depends(_service),
):
    return await service.get_history(uuid.UUID(current_user["sub"]))


@router.get("/history/{user_id}", response_model=list[WorkSessionRead])
async def get_user_history(
    user_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    service: WorkService = Depends(_service),
):
    if str(user_id) == current_user["sub"]:
        return await service.get_history(user_id)
    if not MANAGEABLE_ROLES.get(current_user["role"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return await service.get_history(user_id)

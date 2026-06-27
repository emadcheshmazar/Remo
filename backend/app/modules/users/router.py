import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.shared.dependencies import get_current_user
from app.modules.users.schema import UserCreate, UserRead, UserUpdate, SupervisorAssign
from app.modules.users.service import UserService
from app.modules.users.repository import UserRepository

router = APIRouter(prefix="/users", tags=["users"])


def _service(session: AsyncSession = Depends(get_session)) -> UserService:
    return UserService(UserRepository(session))


@router.get("", response_model=list[UserRead])
async def list_users(
    current_user: dict = Depends(get_current_user),
    service: UserService = Depends(_service),
):
    return await service.list_users(uuid.UUID(current_user["sub"]), current_user["role"])


@router.patch("/{user_id}/supervisor", response_model=UserRead)
async def assign_supervisor(
    user_id: uuid.UUID,
    data: SupervisorAssign,
    current_user: dict = Depends(get_current_user),
    service: UserService = Depends(_service),
):
    return await service.assign_supervisor(
        user_id, data.supervisor_id,
        uuid.UUID(current_user["sub"]), current_user["role"],
    )


@router.post("", response_model=UserRead, status_code=201)
async def create_user(
    data: UserCreate,
    current_user: dict = Depends(get_current_user),
    service: UserService = Depends(_service),
):
    return await service.create_user(
        data, uuid.UUID(current_user["sub"]), current_user["role"]
    )


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    service: UserService = Depends(_service),
):
    return await service.get_user(user_id, current_user["role"])


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    current_user: dict = Depends(get_current_user),
    service: UserService = Depends(_service),
):
    return await service.update_user(user_id, data, current_user["role"])


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    service: UserService = Depends(_service),
):
    await service.delete_user(user_id, current_user["role"])

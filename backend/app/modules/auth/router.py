import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.core.security import create_access_token
from app.shared.dependencies import get_current_user
from app.modules.auth.schema import LoginRequest, TokenResponse, MeResponse
from app.modules.users.schema import PasswordChange
from app.modules.users.repository import UserRepository
from app.modules.users.service import UserService

router = APIRouter(prefix="/auth", tags=["auth"])


def _service(session: AsyncSession = Depends(get_session)) -> UserService:
    return UserService(UserRepository(session))


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    service: UserService = Depends(_service),
):
    user = await service.authenticate(data.username, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    me = MeResponse(
        id=str(user.id),
        username=user.username,
        full_name=user.full_name,
        role=user.role,
    )
    token = create_access_token({
        "sub": str(user.id),
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
    })
    return TokenResponse(access_token=token, user=me)


@router.get("/me", response_model=MeResponse)
async def me(current_user: dict = Depends(get_current_user)):
    return MeResponse(
        id=current_user["sub"],
        username=current_user["username"],
        full_name=current_user.get("full_name", ""),
        role=current_user["role"],
    )


@router.patch("/me/password", status_code=204)
async def change_password(
    data: PasswordChange,
    current_user: dict = Depends(get_current_user),
    service: UserService = Depends(_service),
):
    await service.change_own_password(uuid.UUID(current_user["sub"]), data)

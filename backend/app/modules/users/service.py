import uuid
from fastapi import HTTPException, status
from app.modules.users.model import User
from app.modules.users.schema import UserCreate, UserUpdate, PasswordChange
from app.modules.users.repository import UserRepository
from app.core.security import hash_password, verify_password
from app.shared.roles import MANAGEABLE_ROLES


class UserService:
    def __init__(self, repo: UserRepository):
        self.repo = repo

    def _assert_can_manage(self, actor_role: str, target_role: str) -> None:
        if target_role not in MANAGEABLE_ROLES.get(actor_role, []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role {actor_role} cannot manage role {target_role}",
            )

    async def create_user(
        self, data: UserCreate, actor_id: uuid.UUID, actor_role: str
    ) -> User:
        self._assert_can_manage(actor_role, data.role)
        if await self.repo.get_by_username(data.username):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already exists",
            )
        user = User(
            username=data.username,
            password_hash=hash_password(data.password),
            full_name=data.full_name,
            role=data.role,
            created_by=actor_id,
        )
        return await self.repo.create(user)

    async def get_user(self, user_id: uuid.UUID, actor_role: str) -> User:
        user = await self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        self._assert_can_manage(actor_role, user.role)
        return user

    async def list_users(self, actor_role: str) -> list[User]:
        manageable = MANAGEABLE_ROLES.get(actor_role, [])
        return await self.repo.list_by_roles(manageable)

    async def update_user(
        self, user_id: uuid.UUID, data: UserUpdate, actor_role: str
    ) -> User:
        user = await self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        self._assert_can_manage(actor_role, user.role)
        if data.full_name is not None:
            user.full_name = data.full_name
        if data.is_active is not None:
            user.is_active = data.is_active
        if data.password is not None:
            user.password_hash = hash_password(data.password)
        return await self.repo.update(user)

    async def delete_user(self, user_id: uuid.UUID, actor_role: str) -> None:
        user = await self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        self._assert_can_manage(actor_role, user.role)
        await self.repo.delete(user)

    async def authenticate(self, username: str, password: str) -> User | None:
        user = await self.repo.get_by_username(username)
        if not user or not user.is_active:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user

    async def change_own_password(
        self, user_id: uuid.UUID, data: PasswordChange
    ) -> None:
        user = await self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if not verify_password(data.current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )
        user.password_hash = hash_password(data.new_password)
        await self.repo.update(user)

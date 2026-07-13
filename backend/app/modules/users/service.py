import uuid
from typing import Optional
from fastapi import HTTPException, status
from app.modules.users.model import User
from app.modules.users.schema import UserCreate, UserUpdate, PasswordChange
from app.modules.users.repository import UserRepository
from app.core.security import hash_password, verify_password
from app.shared.roles import MANAGEABLE_ROLES, UserRole
from app.shared.scope import resolve_owned_user


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
        supervisor_id = (
            actor_id
            if actor_role == UserRole.SUPERVISOR and data.role == UserRole.MEMBER
            else None
        )
        user = User(
            username=data.username,
            password_hash=hash_password(data.password),
            full_name=data.full_name,
            role=data.role,
            created_by=actor_id,
            supervisor_id=supervisor_id,
        )
        return await self.repo.create(user)

    async def get_user(self, user_id: uuid.UUID, actor_id: uuid.UUID, actor_role: str) -> User:
        target = await resolve_owned_user(self.repo, actor_id, actor_role, user_id)
        self._assert_can_manage(actor_role, target.role)
        return target

    async def list_users(self, actor_id: uuid.UUID, actor_role: str) -> list[User]:
        if actor_role == UserRole.ADMIN:
            return await self.repo.list_by_roles([UserRole.MANAGER])
        if actor_role == UserRole.MANAGER:
            return await self.repo.list_for_manager(actor_id)
        if actor_role == UserRole.SUPERVISOR:
            return await self.repo.list_for_supervisor(actor_id)
        return []

    async def list_users_for_calendar(self, actor_id: uuid.UUID, actor_role: str) -> list[User]:
        """Expanded visibility for calendar — everyone sees their whole
        manager's org (all supervisors + members), not just their own direct
        team. This only governs the plain remote/leave listing — who can open
        someone else's day *detail* is a separate, narrower check."""
        if actor_role == UserRole.ADMIN:
            return []
        if actor_role == UserRole.MANAGER:
            return await self.repo.list_for_manager(actor_id)
        # SUPERVISOR and MEMBER: everyone under the same manager.
        actor = await self.repo.get_by_id(actor_id)
        if not actor:
            return []
        manager_id = await self.repo.find_manager_id(actor)
        if manager_id:
            return await self.repo.list_for_manager(manager_id)
        return [actor]

    async def assign_supervisor(
        self,
        member_id: uuid.UUID,
        supervisor_id: Optional[uuid.UUID],
        actor_id: uuid.UUID,
        actor_role: str,
    ) -> User:
        if actor_role != UserRole.MANAGER:
            raise HTTPException(status_code=403, detail="Only managers can assign supervisors")
        member = await resolve_owned_user(self.repo, actor_id, actor_role, member_id)
        if member.role != UserRole.MEMBER:
            raise HTTPException(status_code=404, detail="Member not found")
        if supervisor_id:
            supervisor = await self.repo.get_by_id(supervisor_id)
            if (
                not supervisor
                or supervisor.role != UserRole.SUPERVISOR
                or supervisor.created_by != actor_id
            ):
                raise HTTPException(status_code=403, detail="Supervisor not in your team")
        member.supervisor_id = supervisor_id
        return await self.repo.update(member)

    async def update_user(
        self, user_id: uuid.UUID, data: UserUpdate, actor_id: uuid.UUID, actor_role: str
    ) -> User:
        user = await resolve_owned_user(self.repo, actor_id, actor_role, user_id)
        self._assert_can_manage(actor_role, user.role)
        if data.username is not None and data.username != user.username:
            if await self.repo.get_by_username(data.username):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Username already exists",
                )
            user.username = data.username
        if data.full_name is not None:
            user.full_name = data.full_name
        if data.is_active is not None:
            user.is_active = data.is_active
        if data.password is not None:
            user.password_hash = hash_password(data.password)
        if data.role is not None and data.role != user.role:
            # Only allow reassigning to a role the actor is itself allowed to
            # assign — the same rule that governs who they can create.
            self._assert_can_manage(actor_role, data.role)
            user.role = data.role
            if data.role != UserRole.MEMBER:
                user.supervisor_id = None
        return await self.repo.update(user)

    async def delete_user(self, user_id: uuid.UUID, actor_id: uuid.UUID, actor_role: str) -> None:
        user = await resolve_owned_user(self.repo, actor_id, actor_role, user_id)
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

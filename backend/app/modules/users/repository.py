import uuid
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.users.model import User
from app.shared.roles import UserRole


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> User | None:
        result = await self.session.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()

    async def list_by_roles(self, roles: list[UserRole]) -> list[User]:
        if not roles:
            return []
        result = await self.session.execute(
            select(User)
            .where(User.role.in_(roles))
            .order_by(User.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_for_manager(self, manager_id: uuid.UUID) -> list[User]:
        supervisor_ids_subq = (
            select(User.id)
            .where(User.role == UserRole.SUPERVISOR, User.created_by == manager_id)
            .scalar_subquery()
        )
        stmt = (
            select(User)
            .where(
                or_(
                    and_(User.role == UserRole.SUPERVISOR, User.created_by == manager_id),
                    and_(
                        User.role == UserRole.MEMBER,
                        or_(
                            User.created_by == manager_id,
                            User.created_by.in_(supervisor_ids_subq),
                            User.supervisor_id.in_(supervisor_ids_subq),
                        ),
                    ),
                )
            )
            .order_by(User.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_for_supervisor(self, supervisor_id: uuid.UUID) -> list[User]:
        result = await self.session.execute(
            select(User)
            .where(User.role == UserRole.MEMBER, User.supervisor_id == supervisor_id)
            .order_by(User.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_teammates(self, supervisor_id: uuid.UUID) -> list[User]:
        """Supervisor + all their members — used for calendar visibility."""
        result = await self.session.execute(
            select(User)
            .where(or_(User.id == supervisor_id, User.supervisor_id == supervisor_id))
            .order_by(User.created_at.desc())
        )
        return list(result.scalars().all())

    async def create(self, user: User) -> User:
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def update(self, user: User) -> User:
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def delete(self, user: User) -> None:
        await self.session.delete(user)
        await self.session.commit()

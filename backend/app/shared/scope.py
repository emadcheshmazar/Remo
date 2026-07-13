import uuid
from fastapi import HTTPException, status
from app.modules.users.model import User
from app.modules.users.repository import UserRepository
from app.shared.roles import UserRole


async def resolve_owned_user(
    user_repo: UserRepository,
    actor_id: uuid.UUID,
    actor_role: str,
    target_id: uuid.UUID,
    *,
    allow_self: bool = True,
    allow_admin: bool = True,
) -> User:
    """Fetch `target_id` and verify the actor may access/manage this specific
    user's data. Unlike a role-tier check (e.g. MANAGEABLE_ROLES), this
    confirms the target actually belongs to the actor's own org/team, not
    just that the actor's role is generically allowed to manage that tier.

    Raises 404 if the user doesn't exist, 403 if they exist but are outside
    the actor's scope.
    """
    target = await user_repo.get_by_id(target_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if allow_self and actor_id == target_id:
        return target

    if actor_role == UserRole.ADMIN:
        if allow_admin:
            return target
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    if actor_role == UserRole.MANAGER:
        manager_id = await user_repo.find_manager_id(target)
        if manager_id != actor_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This user is not in your team")
        return target

    if actor_role == UserRole.SUPERVISOR:
        if target.supervisor_id != actor_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This user is not in your team")
        return target

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

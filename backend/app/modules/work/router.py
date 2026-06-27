import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.core.events import broadcast
from app.shared.dependencies import get_current_user
from app.shared.roles import MANAGEABLE_ROLES, UserRole
from app.modules.work.schema import WorkSessionRead, WorkSummary
from app.modules.work.service import WorkService
from app.modules.work.repository import WorkRepository
from app.modules.status.service import StatusService
from app.modules.status.repository import StatusRepository
from app.modules.timeline.service import TimelineService
from app.modules.timeline.repository import TimelineRepository
from app.modules.users.model import User
from app.modules.users.repository import UserRepository

router = APIRouter(prefix="/work", tags=["work"])


def _service(session: AsyncSession = Depends(get_session)) -> WorkService:
    return WorkService(WorkRepository(session))


def _status(session: AsyncSession = Depends(get_session)) -> StatusService:
    return StatusService(StatusRepository(session))


def _timeline(session: AsyncSession = Depends(get_session)) -> TimelineService:
    return TimelineService(TimelineRepository(session))


def _users(session: AsyncSession = Depends(get_session)) -> UserRepository:
    return UserRepository(session)


async def _resolve_target(
    target_id: uuid.UUID,
    current_user: dict,
    user_repo: UserRepository,
) -> User:
    """Fetch target user and verify the caller is allowed to control their session."""
    target = await user_repo.get_by_id(target_id)
    if not target or not target.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    actor_id = uuid.UUID(current_user["sub"])
    role = current_user["role"]

    if role == UserRole.ADMIN:
        return target

    if role == UserRole.MANAGER:
        team = await user_repo.list_for_manager(actor_id)
        if not any(u.id == target_id for u in team):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not in your team")
        return target

    if role == UserRole.SUPERVISOR:
        if target.supervisor_id != actor_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not in your team")
        return target

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")


@router.post("/start", response_model=WorkSessionRead, status_code=201)
async def start_session(
    current_user: dict = Depends(get_current_user),
    service: WorkService = Depends(_service),
    status_svc: StatusService = Depends(_status),
    timeline: TimelineService = Depends(_timeline),
):
    user_id = uuid.UUID(current_user["sub"])
    session = await service.start_session(user_id)
    await timeline.add_event(user_id, "SESSION_START", {"session_id": str(session.id)})
    updated = await status_svc.update_status(user_id, "AVAILABLE")
    await broadcast({
        "type": "update",
        "user_id": str(user_id),
        "status": "AVAILABLE",
        "updated_at": updated.updated_at.isoformat(),
    })
    return session


@router.post("/end", response_model=WorkSessionRead)
async def end_session(
    current_user: dict = Depends(get_current_user),
    service: WorkService = Depends(_service),
    status_svc: StatusService = Depends(_status),
    timeline: TimelineService = Depends(_timeline),
):
    user_id = uuid.UUID(current_user["sub"])
    session = await service.end_session(user_id)
    await timeline.add_event(
        user_id,
        "SESSION_END",
        {"session_id": str(session.id), "duration_minutes": session.duration_minutes},
    )
    updated = await status_svc.update_status(user_id, "OFFLINE")
    await broadcast({
        "type": "update",
        "user_id": str(user_id),
        "status": "OFFLINE",
        "updated_at": updated.updated_at.isoformat(),
    })
    return session


@router.post("/{user_id}/start", response_model=WorkSessionRead, status_code=201)
async def start_session_for(
    user_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    service: WorkService = Depends(_service),
    status_svc: StatusService = Depends(_status),
    timeline: TimelineService = Depends(_timeline),
    user_repo: UserRepository = Depends(_users),
):
    await _resolve_target(user_id, current_user, user_repo)
    session = await service.start_session(user_id)
    await timeline.add_event(
        user_id,
        "SESSION_START",
        {"session_id": str(session.id), "started_by": current_user["sub"]},
    )
    updated = await status_svc.update_status(user_id, "AVAILABLE")
    await broadcast({
        "type": "update",
        "user_id": str(user_id),
        "status": "AVAILABLE",
        "updated_at": updated.updated_at.isoformat(),
    })
    return session


@router.post("/{user_id}/end", response_model=WorkSessionRead)
async def end_session_for(
    user_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    service: WorkService = Depends(_service),
    status_svc: StatusService = Depends(_status),
    timeline: TimelineService = Depends(_timeline),
    user_repo: UserRepository = Depends(_users),
):
    await _resolve_target(user_id, current_user, user_repo)
    session = await service.end_session(user_id)
    await timeline.add_event(
        user_id,
        "SESSION_END",
        {
            "session_id": str(session.id),
            "duration_minutes": session.duration_minutes,
            "ended_by": current_user["sub"],
        },
    )
    updated = await status_svc.update_status(user_id, "OFFLINE")
    await broadcast({
        "type": "update",
        "user_id": str(user_id),
        "status": "OFFLINE",
        "updated_at": updated.updated_at.isoformat(),
    })
    return session


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

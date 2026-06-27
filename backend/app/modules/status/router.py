import asyncio
import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.core.events import broadcast, subscribe, unsubscribe
from app.core.security import decode_token
from app.shared.dependencies import get_current_user
from app.modules.status.schema import StatusRead, StatusUpdate, StatusLogRead, PingRequest, PingRespondRequest
from app.modules.users.repository import UserRepository
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
    # tag=None → clear tag → back to AVAILABLE; tag=FOCUS/BREAK/MEETING → set that
    new_status = data.tag.value if data.tag else "AVAILABLE"
    result = await service.update_status(user_id, new_status)
    await timeline.add_event(user_id, "STATUS_CHANGE", {"to": new_status})
    await broadcast({
        "type": "update",
        "user_id": str(user_id),
        "status": new_status,
        "updated_at": result.updated_at.isoformat(),
    })
    return result


@router.get("", response_model=list[StatusRead])
async def get_all_statuses(
    current_user: dict = Depends(get_current_user),
    service: StatusService = Depends(_service),
):
    return await service.get_all()


@router.get("/stream")
async def status_stream(
    request: Request,
    token: str = Query(...),
    session: AsyncSession = Depends(get_session),
):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    service = StatusService(StatusRepository(session))
    all_statuses = await service.get_all()
    initial = json.dumps({
        "type": "snapshot",
        "statuses": [
            {
                "user_id": str(s.user_id),
                "status": s.status,
                "updated_at": s.updated_at.isoformat(),
            }
            for s in all_statuses
        ],
    })

    async def generator():
        yield f"data: {initial}\n\n"
        q = subscribe()
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(q.get(), timeout=25)
                    yield f"data: {data}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            unsubscribe(q)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _user_repo(session: AsyncSession = Depends(get_session)) -> UserRepository:
    return UserRepository(session)


@router.post("/ping/{user_id}")
async def send_ping(
    user_id: uuid.UUID,
    body: PingRequest,
    current_user: dict = Depends(get_current_user),
    user_repo: UserRepository = Depends(_user_repo),
):
    actor_role = current_user["role"]
    actor_id = uuid.UUID(current_user["sub"])

    if actor_role not in ("MANAGER", "SUPERVISOR"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    if actor_role == "SUPERVISOR":
        target = await user_repo.get_by_id(user_id)
        if not target or target.supervisor_id != actor_id:
            raise HTTPException(status_code=403, detail="Can only ping your direct team members")

    check_id = str(uuid.uuid4())
    await broadcast({
        "type": "ping_check",
        "check_id": check_id,
        "target_user_id": str(user_id),
        "from_user_id": current_user["sub"],
        "from_name": current_user.get("full_name", ""),
        "message": body.message,
    })
    return {"check_id": check_id}


@router.post("/ping/{check_id}/respond")
async def respond_ping(
    check_id: str,
    body: PingRespondRequest,
    current_user: dict = Depends(get_current_user),
):
    await broadcast({
        "type": "ping_response",
        "check_id": check_id,
        "from_user_id": body.from_user_id,
        "target_user_id": current_user["sub"],
        "target_name": current_user.get("full_name", ""),
        "reply_message": body.reply_message,
    })
    return {"ok": True}


@router.get("/{user_id}/log", response_model=list[StatusLogRead])
async def get_status_log(
    user_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    service: StatusService = Depends(_service),
):
    return await service.get_log(user_id)

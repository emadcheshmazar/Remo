import uuid
from typing import Literal

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.uploads import absolute_path
from app.modules.tasks.schema import (
    ApprovalRequest,
    AttachmentRead,
    LabelCreate,
    LabelRead,
    LabelUpdate,
    TaskCreate,
    TaskCreateResult,
    TaskDetail,
    TaskRead,
    TaskUpdate,
    TransitionRequest,
    UserBrief,
)
from app.modules.tasks.service import TaskService
from app.shared.dependencies import get_current_user

router = APIRouter(tags=["tasks"])


def _svc(session: AsyncSession = Depends(get_session)) -> TaskService:
    return TaskService(session)


def _actor(current_user: dict) -> tuple[uuid.UUID, str]:
    return uuid.UUID(current_user["sub"]), current_user["role"]


@router.get("/tasks", response_model=list[TaskRead])
async def list_tasks(
    scope: Literal["mine", "team", "inbox"] = "team",
    status: str | None = None,
    priority: str | None = None,
    task_type: Literal["sprint", "urgent"] | None = None,
    due: Literal["overdue", "week", "ets", "today", "hot"] | None = None,
    pipeline: Literal["backlog", "approved"] | None = None,
    label_id: uuid.UUID | None = None,
    unsynced: bool = False,
    needs_assignment: bool | None = None,
    parent_task_id: uuid.UUID | None = None,
    roots_only: bool = True,
    assignee_id: uuid.UUID | None = None,
    q: str | None = None,
    current_user: dict = Depends(get_current_user),
    svc: TaskService = Depends(_svc),
):
    actor_id, role = _actor(current_user)
    return await svc.list_tasks(
        actor_id,
        role,
        scope=scope,
        status_filter=status,
        priority=priority,
        task_type=task_type,
        due=due,
        pipeline=pipeline,
        label_id=label_id,
        unsynced=unsynced,
        needs_assignment=needs_assignment,
        parent_task_id=parent_task_id,
        roots_only=roots_only and parent_task_id is None,
        assignee_id=assignee_id,
        q=q,
    )


@router.get("/tasks/assignable-users", response_model=list[UserBrief])
async def assignable_users(
    current_user: dict = Depends(get_current_user),
    svc: TaskService = Depends(_svc),
):
    actor_id, role = _actor(current_user)
    return await svc.briefs(actor_id, role)


@router.post("/tasks", response_model=TaskCreateResult, status_code=201)
async def create_task(
    body: TaskCreate,
    current_user: dict = Depends(get_current_user),
    svc: TaskService = Depends(_svc),
):
    actor_id, role = _actor(current_user)
    return await svc.create_task(body, actor_id, role)


@router.get("/tasks/attachments/{attachment_id}/file")
async def download_attachment(
    attachment_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    svc: TaskService = Depends(_svc),
):
    actor_id, role = _actor(current_user)
    row = await svc.get_attachment_file(attachment_id, actor_id, role)
    path = absolute_path(row.storage_path)
    return FileResponse(path, media_type=row.content_type or "application/octet-stream", filename=row.filename)


@router.delete("/tasks/attachments/{attachment_id}", status_code=204)
async def remove_attachment(
    attachment_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    svc: TaskService = Depends(_svc),
):
    actor_id, role = _actor(current_user)
    await svc.delete_attachment(attachment_id, actor_id, role)


@router.get("/tasks/{task_id}", response_model=TaskDetail)
async def get_task(
    task_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    svc: TaskService = Depends(_svc),
):
    actor_id, role = _actor(current_user)
    return await svc.get_task(task_id, actor_id, role)


@router.patch("/tasks/{task_id}", response_model=TaskDetail)
async def update_task(
    task_id: uuid.UUID,
    body: TaskUpdate,
    current_user: dict = Depends(get_current_user),
    svc: TaskService = Depends(_svc),
):
    actor_id, role = _actor(current_user)
    return await svc.update_task(task_id, body, actor_id, role)


@router.post("/tasks/{task_id}/transition", response_model=TaskDetail)
async def transition_task(
    task_id: uuid.UUID,
    body: TransitionRequest,
    current_user: dict = Depends(get_current_user),
    svc: TaskService = Depends(_svc),
):
    actor_id, role = _actor(current_user)
    return await svc.transition(task_id, body.status, actor_id, role)


@router.post("/tasks/{task_id}/approve", response_model=TaskDetail)
async def approve_task(
    task_id: uuid.UUID,
    body: ApprovalRequest | None = None,
    current_user: dict = Depends(get_current_user),
    svc: TaskService = Depends(_svc),
):
    actor_id, role = _actor(current_user)
    approve = True if body is None else body.approve
    return await svc.set_approval(task_id, approve, actor_id, role)


@router.post("/tasks/{task_id}/sync/retry", response_model=TaskDetail)
async def retry_sync(
    task_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    svc: TaskService = Depends(_svc),
):
    actor_id, role = _actor(current_user)
    return await svc.retry_sync(task_id, actor_id, role)


@router.delete("/tasks/{task_id}", response_model=TaskDetail)
async def cancel_task(
    task_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    svc: TaskService = Depends(_svc),
):
    actor_id, role = _actor(current_user)
    return await svc.cancel(task_id, actor_id, role)


@router.post("/tasks/{task_id}/attachments", response_model=AttachmentRead, status_code=201)
async def upload_attachment(
    task_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    svc: TaskService = Depends(_svc),
):
    actor_id, role = _actor(current_user)
    return await svc.add_attachment(task_id, file, actor_id, role)


@router.get("/task-labels", response_model=list[LabelRead])
async def list_labels(
    current_user: dict = Depends(get_current_user),
    svc: TaskService = Depends(_svc),
):
    actor_id, role = _actor(current_user)
    return await svc.list_labels(actor_id, role)


@router.post("/task-labels", response_model=LabelRead, status_code=201)
async def create_label(
    body: LabelCreate,
    current_user: dict = Depends(get_current_user),
    svc: TaskService = Depends(_svc),
):
    actor_id, role = _actor(current_user)
    return await svc.create_label(body, actor_id, role)


@router.patch("/task-labels/{label_id}", response_model=LabelRead)
async def update_label(
    label_id: uuid.UUID,
    body: LabelUpdate,
    current_user: dict = Depends(get_current_user),
    svc: TaskService = Depends(_svc),
):
    actor_id, role = _actor(current_user)
    return await svc.update_label(label_id, body, actor_id, role)


@router.delete("/task-labels/{label_id}", status_code=204)
async def delete_label(
    label_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    svc: TaskService = Depends(_svc),
):
    actor_id, role = _actor(current_user)
    await svc.delete_label(label_id, actor_id, role)

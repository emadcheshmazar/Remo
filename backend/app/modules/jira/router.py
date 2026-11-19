import hmac
import uuid

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.modules.jira.service import JiraSettingsService
from app.modules.jira.sync import get_connection, handle_webhook, pull_recent
from app.modules.tasks.schema import (
    JiraConnectionRead,
    JiraConnectionWrite,
    JiraPeopleImportRequest,
    JiraPeopleImportResult,
    JiraPersonPreview,
    JiraStatusMapWrite,
    SyncJobRead,
    UserBrief,
    UserMapRead,
    UserMapWrite,
    WebhookRegisterRequest,
)
from app.shared.dependencies import require_roles
from app.shared.roles import UserRole

router = APIRouter(tags=["jira"])


def _svc(session: AsyncSession = Depends(get_session)) -> JiraSettingsService:
    return JiraSettingsService(session)


def _actor(current_user: dict) -> tuple[uuid.UUID, str]:
    return uuid.UUID(current_user["sub"]), current_user["role"]


def _secret_matches(provided: str, expected: str) -> bool:
    if not provided or not expected:
        return False
    return hmac.compare_digest(provided.encode(), expected.encode())


@router.get("/jira/connection", response_model=JiraConnectionRead | None)
async def read_connection(
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    svc: JiraSettingsService = Depends(_svc),
):
    return await svc.read()


@router.put("/jira/connection", response_model=JiraConnectionRead)
async def save_connection(
    body: JiraConnectionWrite,
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    svc: JiraSettingsService = Depends(_svc),
):
    actor_id, role = _actor(current_user)
    return await svc.save(body, actor_id, role)


@router.post("/jira/connection/test")
async def test_connection(
    body: JiraConnectionWrite | None = None,
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    svc: JiraSettingsService = Depends(_svc),
):
    return await svc.test(body)


@router.get("/jira/projects")
async def list_projects(
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    svc: JiraSettingsService = Depends(_svc),
):
    return await svc.projects()


@router.get("/jira/issuetypes")
async def list_issue_types(
    project: str | None = None,
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    svc: JiraSettingsService = Depends(_svc),
):
    return await svc.issue_types(project)


@router.get("/jira/boards")
async def list_boards(
    project: str | None = None,
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    svc: JiraSettingsService = Depends(_svc),
):
    return await svc.boards(project)


@router.get("/jira/sprints")
async def list_sprints(
    board_id: int | None = None,
    state: str | None = None,
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    svc: JiraSettingsService = Depends(_svc),
):
    return await svc.sprints(board_id, state)


@router.post("/jira/board/sync", response_model=JiraConnectionRead)
async def sync_board(
    board_id: int | None = None,
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    svc: JiraSettingsService = Depends(_svc),
):
    return await svc.sync_board(board_id)


@router.get("/jira/status-map")
async def read_status_map(
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    svc: JiraSettingsService = Depends(_svc),
):
    conn = await svc.read()
    if conn is None:
        raise HTTPException(status_code=400, detail="Jira is not configured")
    return conn.status_map


@router.put("/jira/status-map")
async def save_status_map(
    body: JiraStatusMapWrite,
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    svc: JiraSettingsService = Depends(_svc),
):
    return await svc.save_status_map(body.status_map)


@router.get("/jira/user-map", response_model=list[UserMapRead])
async def read_user_map(
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    svc: JiraSettingsService = Depends(_svc),
):
    return await svc.user_maps()


@router.put("/jira/user-map", response_model=list[UserMapRead])
async def save_user_map(
    body: UserMapWrite,
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    svc: JiraSettingsService = Depends(_svc),
):
    return await svc.save_user_maps(body.items)


@router.get("/jira/users/search")
async def search_jira_users(
    q: str = Query(min_length=1),
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    svc: JiraSettingsService = Depends(_svc),
):
    return await svc.search_users(q)


@router.get("/jira/people/preview", response_model=list[JiraPersonPreview])
async def preview_jira_people(
    project: str | None = None,
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    svc: JiraSettingsService = Depends(_svc),
):
    return await svc.preview_project_people(project)


@router.post("/jira/people/import", response_model=JiraPeopleImportResult)
async def import_jira_people(
    body: JiraPeopleImportRequest,
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    svc: JiraSettingsService = Depends(_svc),
):
    actor_id, role = _actor(current_user)
    return await svc.import_project_people(body, actor_id, role)


@router.get("/jira/remo-users", response_model=list[UserBrief])
async def remo_users_for_mapping(
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    svc: JiraSettingsService = Depends(_svc),
):
    actor_id, role = _actor(current_user)
    return await svc.mappable_users(actor_id, role)


@router.get("/jira/sync/jobs", response_model=list[SyncJobRead])
async def sync_jobs(
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    svc: JiraSettingsService = Depends(_svc),
):
    return await svc.jobs()


@router.post("/jira/webhook/register")
async def register_webhook(
    body: WebhookRegisterRequest | None = None,
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    svc: JiraSettingsService = Depends(_svc),
):
    return await svc.register_webhook(body.callback_url if body else None)


@router.post("/jira/sync/pull")
async def pull_now(
    body: dict | None = Body(default=None),
    sprint_id: int | None = None,
    current_user: dict = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER)),
    session: AsyncSession = Depends(get_session),
):
    selected_sprint = sprint_id or ((body or {}).get("sprint_id") if isinstance(body, dict) else None)
    count = await pull_recent(session, required=True, sprint_id=selected_sprint)
    return {"updated": count}


@router.post("/jira/webhook")
async def jira_webhook(
    request: Request,
    secret: str | None = None,
    x_remo_webhook_secret: str | None = Header(default=None),
    session: AsyncSession = Depends(get_session),
):
    conn = await get_connection(session)
    provided = secret or x_remo_webhook_secret or ""
    if conn is None or not _secret_matches(provided, conn.webhook_secret):
        raise HTTPException(status_code=401, detail="Invalid webhook secret")
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON")
    return await handle_webhook(session, payload)

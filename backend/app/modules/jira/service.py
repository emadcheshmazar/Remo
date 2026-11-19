import re
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.crypto import decrypt_secret, encrypt_secret
from app.core.security import hash_password
from app.modules.jira.client import JiraClient, JiraError
from app.modules.jira.mapper import normalize_status_map
from app.modules.jira.model import JiraConnection, JiraSyncJob, JiraUserMap
from app.modules.jira.sync import get_connection, link_unmapped
from app.modules.tasks.schema import (
    JiraConnectionRead,
    JiraConnectionWrite,
    JiraPeopleImportRequest,
    JiraPeopleImportResult,
    JiraPeopleImportResultItem,
    JiraPersonPreview,
    SyncJobRead,
    UserBrief,
    UserMapItem,
    UserMapRead,
)
from app.modules.users.model import User
from app.modules.users.repository import UserRepository
from app.modules.users.schema import normalize_username
from app.shared.roles import UserRole


def _now() -> datetime:
    return datetime.now(timezone.utc)


def webhook_callback(secret: str) -> str:
    base = settings.PUBLIC_API_URL.rstrip("/")
    return f"{base}/api/v1/jira/webhook?secret={secret}"


class JiraSettingsService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.users = UserRepository(session)

    async def _error_count(self) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(JiraSyncJob).where(JiraSyncJob.status == "error")
        )
        return int(result.scalar_one())

    def _read(self, conn: JiraConnection, error_count: int) -> JiraConnectionRead:
        status_map = normalize_status_map(conn.status_map if isinstance(conn.status_map, dict) else None)
        return JiraConnectionRead(
            base_url=conn.base_url,
            auth_type=conn.auth_type,
            username=conn.username,
            has_secret=bool(conn.secret_encrypted),
            default_project_key=conn.default_project_key,
            default_issuetype_name=conn.default_issuetype_name,
            default_issuetype_id=conn.default_issuetype_id,
            board_id=conn.board_id,
            board_name=conn.board_name,
            board_columns=conn.board_columns if isinstance(conn.board_columns, list) else [],
            owner_manager_id=conn.owner_manager_id,
            status_map=status_map,
            webhook_secret=conn.webhook_secret,
            webhook_url=webhook_callback(conn.webhook_secret),
            last_polled_at=conn.last_polled_at,
            error_count=error_count,
        )

    async def read(self) -> JiraConnectionRead | None:
        conn = await get_connection(self.session)
        if conn is None:
            return None
        return self._read(conn, await self._error_count())

    async def save(self, data: JiraConnectionWrite, actor_id: uuid.UUID, actor_role: str) -> JiraConnectionRead:
        if not (data.default_project_key or "").strip():
            raise HTTPException(status_code=422, detail="Select a Jira project key")
        conn = await get_connection(self.session)
        if actor_role == UserRole.MANAGER:
            owner = actor_id
        elif data.owner_manager_id is not None:
            owner = data.owner_manager_id
        else:
            owner = conn.owner_manager_id if conn else None
        if data.auth_type == "basic" and not (data.username or (conn.username if conn else None)):
            raise HTTPException(status_code=422, detail="Username is required for basic auth")
        now = _now()
        if conn is None:
            if not data.secret:
                raise HTTPException(status_code=422, detail="Jira token is required")
            conn = JiraConnection(
                base_url=data.base_url,
                auth_type=data.auth_type,
                username=data.username,
                secret_encrypted=encrypt_secret(data.secret),
                default_project_key=data.default_project_key,
                default_issuetype_name=data.default_issuetype_name or "Task",
                default_issuetype_id=data.default_issuetype_id,
                board_id=data.board_id,
                board_name=data.board_name,
                webhook_secret=secrets.token_urlsafe(32),
                status_map=normalize_status_map(data.status_map),
                configured_by=actor_id,
                owner_manager_id=owner,
                created_at=now,
                updated_at=now,
            )
            self.session.add(conn)
        else:
            conn.base_url = data.base_url
            conn.auth_type = data.auth_type
            if data.username is not None:
                conn.username = data.username
            if data.secret:
                conn.secret_encrypted = encrypt_secret(data.secret)
            conn.default_project_key = data.default_project_key
            conn.default_issuetype_name = data.default_issuetype_name or "Task"
            conn.default_issuetype_id = data.default_issuetype_id
            conn.board_id = data.board_id
            conn.board_name = data.board_name
            if data.status_map:
                conn.status_map = normalize_status_map(data.status_map)
            conn.configured_by = actor_id
            conn.owner_manager_id = owner
            conn.updated_at = now
        if conn.board_id:
            await self._sync_board_columns(conn)
        await self.session.commit()
        await self.session.refresh(conn)
        return self._read(conn, await self._error_count())

    async def _sync_board_columns(self, conn: JiraConnection) -> None:
        if not conn.board_id:
            conn.board_columns = []
            return
        try:
            async with JiraClient(
                conn.base_url, conn.auth_type, decrypt_secret(conn.secret_encrypted), conn.username
            ) as client:
                conn.board_columns = await client.board_columns(conn.board_id)
        except JiraError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    async def _open(self, data: JiraConnectionWrite | None) -> tuple[JiraClient, str]:
        conn = await get_connection(self.session)
        if data is not None and data.secret:
            client = JiraClient(data.base_url, data.auth_type, data.secret, data.username)
            project = data.default_project_key
        elif conn is not None:
            base = data.base_url if data is not None else conn.base_url
            auth = data.auth_type if data is not None else conn.auth_type
            username = data.username if data is not None and data.username else conn.username
            project = data.default_project_key if data is not None else conn.default_project_key
            client = JiraClient(base, auth, decrypt_secret(conn.secret_encrypted), username)
        else:
            raise HTTPException(status_code=422, detail="Save the Jira connection first")
        return client, project

    async def test(self, data: JiraConnectionWrite | None) -> dict:
        client, project = await self._open(data)
        try:
            async with client:
                me = await client.myself()
                info = await client.server_info()
                projects = await client.projects()
                try:
                    boards = await client.boards(project) if project else []
                except Exception:
                    boards = []
        except JiraError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Could not reach Jira") from exc
        keys = [item.get("key") for item in projects if item.get("key")]
        return {
            "myself": me.get("displayName") or me.get("name"),
            "server_title": info.get("serverTitle"),
            "version": info.get("version"),
            "deployment": info.get("deploymentType"),
            "project_ok": project in keys,
            "projects": [{"key": item.get("key"), "name": item.get("name")} for item in projects],
            "boards": [{"id": item.get("id"), "name": item.get("name"), "type": item.get("type")} for item in boards],
        }

    async def projects(self) -> list[dict]:
        conn = await get_connection(self.session)
        if conn is None:
            raise HTTPException(status_code=400, detail="Jira is not configured")
        try:
            async with JiraClient(conn.base_url, conn.auth_type, decrypt_secret(conn.secret_encrypted), conn.username) as client:
                projects = await client.projects()
        except JiraError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return [{"id": item.get("id"), "key": item.get("key"), "name": item.get("name")} for item in projects]

    async def issue_types(self, project_key: str | None) -> dict:
        conn = await get_connection(self.session)
        if conn is None:
            raise HTTPException(status_code=400, detail="Jira is not configured")
        key = project_key or conn.default_project_key
        try:
            async with JiraClient(conn.base_url, conn.auth_type, decrypt_secret(conn.secret_encrypted), conn.username) as client:
                return await client.issue_types(key)
        except JiraError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    async def boards(self, project_key: str | None) -> list[dict]:
        conn = await get_connection(self.session)
        if conn is None:
            raise HTTPException(status_code=400, detail="Jira is not configured")
        key = project_key or conn.default_project_key
        try:
            async with JiraClient(conn.base_url, conn.auth_type, decrypt_secret(conn.secret_encrypted), conn.username) as client:
                boards = await client.boards(key)
        except JiraError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return [
            {"id": item.get("id"), "name": item.get("name"), "type": item.get("type")}
            for item in boards
        ]

    async def sprints(self, board_id: int | None, state: str | None) -> list[dict]:
        conn = await get_connection(self.session)
        if conn is None:
            raise HTTPException(status_code=400, detail="Jira is not configured")
        target_board = board_id or conn.board_id
        if not target_board:
            raise HTTPException(status_code=422, detail="Select a Jira board")
        try:
            async with JiraClient(conn.base_url, conn.auth_type, decrypt_secret(conn.secret_encrypted), conn.username) as client:
                sprints = await client.sprints(target_board, state)
        except JiraError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return [
            {
                "id": item.get("id"),
                "name": item.get("name"),
                "state": item.get("state"),
                "startDate": item.get("startDate"),
                "endDate": item.get("endDate"),
                "completeDate": item.get("completeDate"),
            }
            for item in sprints
        ]

    async def sync_board(self, board_id: int | None = None) -> JiraConnectionRead:
        conn = await get_connection(self.session)
        if conn is None:
            raise HTTPException(status_code=400, detail="Jira is not configured")
        if board_id is not None:
            conn.board_id = board_id
        await self._sync_board_columns(conn)
        conn.updated_at = _now()
        await self.session.commit()
        await self.session.refresh(conn)
        return self._read(conn, await self._error_count())

    async def save_status_map(self, status_map: dict) -> dict[str, list[str]]:
        conn = await get_connection(self.session)
        if conn is None:
            raise HTTPException(status_code=400, detail="Jira is not configured")
        conn.status_map = normalize_status_map(status_map)
        conn.updated_at = _now()
        await self.session.commit()
        return normalize_status_map(conn.status_map)

    async def user_maps(self) -> list[UserMapRead]:
        result = await self.session.execute(select(JiraUserMap).order_by(JiraUserMap.jira_username.asc()))
        return [
            UserMapRead(
                id=row.id,
                jira_username=row.jira_username,
                jira_display_name=row.jira_display_name,
                jira_email=row.jira_email,
                remo_user_id=row.remo_user_id,
            )
            for row in result.scalars().all()
        ]

    async def save_user_maps(self, items: list[UserMapItem]) -> list[UserMapRead]:
        seen: set[str] = set()
        for item in items:
            key = item.jira_username.lower()
            if key in seen:
                raise HTTPException(status_code=409, detail=f"Duplicate Jira user {item.jira_username}")
            seen.add(key)
            result = await self.session.execute(
                select(JiraUserMap).where(func.lower(JiraUserMap.jira_username) == key)
            )
            row = result.scalar_one_or_none()
            if row is None:
                row = JiraUserMap(jira_username=item.jira_username, updated_at=_now())
                self.session.add(row)
            row.jira_username = item.jira_username
            row.jira_display_name = item.jira_display_name
            row.jira_email = item.jira_email
            row.remo_user_id = item.remo_user_id
            row.updated_at = _now()
            if item.remo_user_id is not None:
                await link_unmapped(self.session, item.jira_username, item.remo_user_id)
        await self.session.commit()
        return await self.user_maps()

    async def search_users(self, query: str) -> list[dict]:
        conn = await get_connection(self.session)
        if conn is None:
            raise HTTPException(status_code=400, detail="Jira is not configured")
        try:
            async with JiraClient(conn.base_url, conn.auth_type, decrypt_secret(conn.secret_encrypted), conn.username) as client:
                users = await client.user_search(query)
        except JiraError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return [
            {
                "name": item.get("name") or item.get("key"),
                "displayName": item.get("displayName"),
                "emailAddress": item.get("emailAddress"),
            }
            for item in users
        ]

    @staticmethod
    def _suggest_username(jira_username: str, display_name: str | None) -> str:
        raw = (jira_username or "").strip().lower()
        cleaned = re.sub(r"[^a-z0-9_.]+", ".", raw).strip(".")
        if cleaned:
            try:
                return normalize_username(cleaned[:50])
            except ValueError:
                pass
        fallback = re.sub(r"[^a-z0-9]+", ".", (display_name or "user").lower()).strip(".") or "user"
        try:
            return normalize_username(fallback[:50])
        except ValueError:
            return f"jira.{uuid.uuid4().hex[:8]}"

    async def preview_project_people(self, project_key: str | None = None) -> list[JiraPersonPreview]:
        conn = await get_connection(self.session)
        if conn is None:
            raise HTTPException(status_code=400, detail="Jira is not configured")
        key = (project_key or conn.default_project_key or "").strip()
        if not key:
            raise HTTPException(status_code=422, detail="Select a Jira project first")
        try:
            async with JiraClient(
                conn.base_url, conn.auth_type, decrypt_secret(conn.secret_encrypted), conn.username
            ) as client:
                rows = await client.assignable_users(key)
        except JiraError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        maps = {
            row.jira_username.lower(): row
            for row in (
                await self.session.execute(select(JiraUserMap))
            ).scalars().all()
        }
        remo_ids = {row.remo_user_id for row in maps.values() if row.remo_user_id}
        remo_by_id: dict[uuid.UUID, User] = {}
        if remo_ids:
            result = await self.session.execute(select(User).where(User.id.in_(remo_ids)))
            remo_by_id = {user.id: user for user in result.scalars().all()}
        remo_by_username: dict[str, User] = {}
        result = await self.session.execute(select(User))
        for user in result.scalars().all():
            remo_by_username[user.username.lower()] = user

        preview: list[JiraPersonPreview] = []
        seen: set[str] = set()
        for item in rows:
            name = (item.get("name") or item.get("key") or "").strip()
            if not name or name.lower() in seen:
                continue
            if item.get("active") is False:
                continue
            seen.add(name.lower())
            mapped = maps.get(name.lower())
            remo = remo_by_id.get(mapped.remo_user_id) if mapped and mapped.remo_user_id else None
            suggested = self._suggest_username(name, item.get("displayName"))
            conflict = remo_by_username.get(suggested) if remo is None else None
            if remo is not None:
                status = "mapped"
            elif conflict is not None:
                status = "conflict"
                remo = conflict
            else:
                status = "unmatched"
            preview.append(
                JiraPersonPreview(
                    jira_username=name,
                    jira_display_name=item.get("displayName"),
                    jira_email=item.get("emailAddress"),
                    active=bool(item.get("active", True)),
                    status=status,
                    remo_user_id=remo.id if remo else None,
                    remo_full_name=remo.full_name if remo else None,
                    remo_username=remo.username if remo else None,
                    suggested_username=suggested,
                )
            )
        preview.sort(key=lambda row: (0 if row.status == "unmatched" else 1 if row.status == "conflict" else 2, row.jira_username.lower()))
        return preview

    async def import_project_people(
        self,
        data: JiraPeopleImportRequest,
        actor_id: uuid.UUID,
        actor_role: str,
    ) -> JiraPeopleImportResult:
        if actor_role not in (UserRole.ADMIN, UserRole.MANAGER):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        if not data.people:
            raise HTTPException(status_code=422, detail="Select at least one person")

        manager_id = actor_id if actor_role == UserRole.MANAGER else None
        if actor_role == UserRole.ADMIN:
            conn = await get_connection(self.session)
            manager_id = (conn.owner_manager_id if conn else None) or actor_id

        default_role = (data.default_role or "MEMBER").upper()
        if default_role not in {UserRole.MEMBER, UserRole.SUPERVISOR}:
            raise HTTPException(status_code=422, detail="Import role must be MEMBER or SUPERVISOR")

        if data.default_supervisor_id:
            supervisor = await self.users.get_by_id(data.default_supervisor_id)
            if supervisor is None or supervisor.role != UserRole.SUPERVISOR:
                raise HTTPException(status_code=422, detail="Invalid supervisor")
            if actor_role == UserRole.MANAGER and supervisor.created_by != actor_id:
                raise HTTPException(status_code=403, detail="Supervisor is outside your team")

        results: list[JiraPeopleImportResultItem] = []
        created = linked = skipped = 0

        for item in data.people:
            jira_username = item.jira_username.strip()
            if not jira_username:
                skipped += 1
                results.append(
                    JiraPeopleImportResultItem(
                        jira_username=item.jira_username,
                        action="skipped",
                        detail="Empty Jira username",
                    )
                )
                continue

            role = (item.role or default_role).upper()
            if role not in {UserRole.MEMBER, UserRole.SUPERVISOR}:
                role = default_role
            supervisor_id = item.supervisor_id or data.default_supervisor_id
            if role == UserRole.SUPERVISOR:
                supervisor_id = None

            existing_map = (
                await self.session.execute(
                    select(JiraUserMap).where(func.lower(JiraUserMap.jira_username) == jira_username.lower())
                )
            ).scalar_one_or_none()

            remo_user: User | None = None
            temp_password: str | None = None
            action = "linked"

            if item.remo_user_id:
                remo_user = await self.users.get_by_id(item.remo_user_id)
                if remo_user is None:
                    skipped += 1
                    results.append(
                        JiraPeopleImportResultItem(
                            jira_username=jira_username,
                            action="skipped",
                            detail="Remo user not found",
                        )
                    )
                    continue
            elif existing_map and existing_map.remo_user_id:
                remo_user = await self.users.get_by_id(existing_map.remo_user_id)
                if remo_user is None:
                    existing_map.remo_user_id = None

            if remo_user is None:
                suggested = self._suggest_username(jira_username, item.jira_display_name)
                base = suggested
                suffix = 0
                while await self.users.get_by_username(suggested):
                    suffix += 1
                    suggested = f"{base[:40]}.{suffix}"
                temp_password = secrets.token_urlsafe(10)
                remo_user = User(
                    username=suggested,
                    password_hash=hash_password(temp_password),
                    full_name=(item.jira_display_name or jira_username)[:100],
                    role=role,
                    created_by=manager_id,
                    supervisor_id=supervisor_id if role == UserRole.MEMBER else None,
                )
                self.session.add(remo_user)
                await self.session.flush()
                action = "created"
                created += 1
            else:
                action = "linked"
                linked += 1
                if role == UserRole.MEMBER and supervisor_id and remo_user.supervisor_id is None:
                    remo_user.supervisor_id = supervisor_id

            if existing_map is None:
                existing_map = JiraUserMap(jira_username=jira_username, updated_at=_now())
                self.session.add(existing_map)
            existing_map.jira_username = jira_username
            existing_map.jira_display_name = item.jira_display_name
            existing_map.jira_email = item.jira_email
            existing_map.remo_user_id = remo_user.id
            existing_map.updated_at = _now()
            await link_unmapped(self.session, jira_username, remo_user.id)

            results.append(
                JiraPeopleImportResultItem(
                    jira_username=jira_username,
                    action=action,
                    remo_user_id=remo_user.id,
                    remo_username=remo_user.username,
                    temporary_password=temp_password,
                    detail=None,
                )
            )

        await self.session.commit()
        return JiraPeopleImportResult(
            imported=results,
            created_count=created,
            linked_count=linked,
            skipped_count=skipped,
        )

    async def mappable_users(self, actor_id: uuid.UUID, actor_role: str) -> list[UserBrief]:
        if actor_role == UserRole.ADMIN:
            users = await self.users.list_by_roles([UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.MEMBER])
        elif actor_role == UserRole.MANAGER:
            actor = await self.users.get_by_id(actor_id)
            team = await self.users.list_for_manager(actor_id)
            users = ([actor] if actor else []) + team
        else:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return [
            UserBrief(id=user.id, username=user.username, full_name=user.full_name, role=str(user.role))
            for user in users
            if user is not None
        ]

    async def jobs(self, limit: int = 30) -> list[SyncJobRead]:
        result = await self.session.execute(
            select(JiraSyncJob).order_by(JiraSyncJob.created_at.desc()).limit(limit)
        )
        return [
            SyncJobRead(
                id=row.id,
                task_id=row.task_id,
                job_type=row.job_type,
                status=row.status,
                attempts=row.attempts,
                error=row.error,
                detail=row.detail,
                created_at=row.created_at,
                updated_at=row.updated_at,
            )
            for row in result.scalars().all()
        ]

    async def register_webhook(self, callback_url: str | None) -> dict:
        conn = await get_connection(self.session)
        if conn is None:
            raise HTTPException(status_code=400, detail="Jira is not configured")
        url = (callback_url or webhook_callback(conn.webhook_secret)).strip()
        if "secret=" not in url:
            joiner = "&" if "?" in url else "?"
            url = f"{url}{joiner}secret={conn.webhook_secret}"
        events = ["jira:issue_created", "jira:issue_updated", "jira:issue_deleted"]
        jql = f'project = "{conn.default_project_key}"'
        try:
            async with JiraClient(
                conn.base_url, conn.auth_type, decrypt_secret(conn.secret_encrypted), conn.username
            ) as client:
                result = await client.register_webhook(name="Remo tasks", url=url, events=events, jql=jql)
        except JiraError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {"ok": True, "url": url, "jira": result}

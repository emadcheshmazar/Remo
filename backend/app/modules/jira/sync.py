"""Push Remo tasks to Jira and apply Jira issue payloads locally."""
import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.crypto import decrypt_secret
from app.modules.jira.client import JiraClient, JiraError
from app.modules.jira.mapper import (
    extract_reproduction,
    extract_screenshot_url,
    extract_task_id,
    is_remo_marker,
    issue_url,
    jira_estimate_to_minutes,
    jira_label,
    jira_priority_to_remo,
    minutes_to_jira,
    parse_due,
    parse_jira_datetime,
    pick_transition,
    pick_transition_to_column,
    priority_to_jira,
    remo_id_label,
    remo_status_from_jira,
    remo_task_type_from_labels,
    strip_markers,
    task_fingerprint,
    with_markers,
)
from app.modules.jira.model import JiraConnection, JiraSyncJob, JiraUserMap
from app.modules.tasks.model import Task
from app.modules.tasks.repository import TaskRepository
from app.modules.users.model import User

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def get_connection(session: AsyncSession) -> JiraConnection | None:
    result = await session.execute(select(JiraConnection).limit(1))
    return result.scalar_one_or_none()


def _client_for(conn: JiraConnection) -> JiraClient:
    return JiraClient(
        conn.base_url,
        conn.auth_type,
        decrypt_secret(conn.secret_encrypted),
        conn.username,
    )


def _columns(conn: JiraConnection) -> list[dict]:
    return conn.board_columns if isinstance(conn.board_columns, list) else []


def _find_column(conn: JiraConnection, *, status_id: str | None = None, status_name: str | None = None, name: str | None = None) -> dict | None:
    folded_name = (name or "").strip().lower()
    folded_status = (status_name or "").strip().lower()
    status_id = str(status_id or "").strip()
    for column in _columns(conn):
        if folded_name and str(column.get("name") or "").strip().lower() == folded_name:
            return column
        ids = {str(item) for item in column.get("status_ids") or []}
        names = {str(item).strip().lower() for item in column.get("status_names") or []}
        if status_id and status_id in ids:
            return column
        if folded_status and folded_status in names:
            return column
    return None


def _column_name(conn: JiraConnection, status_id: str | None, status_name: str | None) -> str | None:
    column = _find_column(conn, status_id=status_id, status_name=status_name)
    return str(column.get("name")) if column else None


def _sprint_from_value(value: object) -> tuple[int | None, str | None]:
    if isinstance(value, dict):
        raw_id = value.get("id")
        try:
            sprint_id = int(raw_id) if raw_id is not None else None
        except (TypeError, ValueError):
            sprint_id = None
        return sprint_id, value.get("name")
    if isinstance(value, list) and value:
        return _sprint_from_value(value[-1])
    if isinstance(value, str):
        id_match = None
        name_match = None
        for part in value.split(","):
            key, _, raw = part.partition("=")
            if key.strip() == "id":
                id_match = raw.strip()
            elif key.strip() == "name":
                name_match = raw.strip()
        return (int(id_match) if id_match and id_match.isdigit() else None), name_match
    return None, None


def _sprint_from_fields(fields: dict, fallback_id: int | None, fallback_name: str | None) -> tuple[int | None, str | None]:
    for key, value in fields.items():
        if key == "sprint" or key.lower().startswith("customfield_"):
            sprint_id, sprint_name = _sprint_from_value(value)
            if sprint_id or sprint_name:
                return sprint_id or fallback_id, sprint_name or fallback_name
    return fallback_id, fallback_name


async def _jira_username(session: AsyncSession, user: User) -> str:
    result = await session.execute(select(JiraUserMap).where(JiraUserMap.remo_user_id == user.id))
    mapping = result.scalars().first()
    if mapping is not None:
        return mapping.jira_username
    return user.username


async def _people(session: AsyncSession, task: Task) -> tuple[list[User], list[str]]:
    repo = TaskRepository(session)
    rows = await repo.assignees_for([task.id])
    ids = [row.user_id for row in rows]
    users_by_id: dict[uuid.UUID, User] = {}
    if ids:
        result = await session.execute(select(User).where(User.id.in_(ids)))
        users_by_id = {user.id: user for user in result.scalars().all()}
    ordered = [users_by_id[row.user_id] for row in rows if row.user_id in users_by_id]
    labels = [label.title for _link, label in await repo.labels_for([task.id])]
    return ordered, labels


async def _fields(session: AsyncSession, task: Task, conn: JiraConnection) -> tuple[dict, str | None]:
    people, label_titles = await _people(session, task)
    primary = people[0] if people else None
    extra_names = [await _jira_username(session, user) for user in people[1:]]
    primary_name = await _jira_username(session, primary) if primary else None
    labels = ["remo", remo_id_label(task.id)]
    kind = (getattr(task, "task_type", None) or "sprint").lower()
    labels.append("remo-urgent" if kind == "urgent" else "remo-sprint")
    pipeline = (getattr(task, "pipeline", None) or "backlog").lower()
    labels.append("remo-approved" if pipeline == "approved" else "remo-backlog")
    for title in label_titles:
        cleaned = jira_label(title)
        if cleaned and cleaned not in labels and not is_remo_marker(cleaned):
            labels.append(cleaned)
    # Urgent Remo tasks nudge Jira priority upward when still medium/low.
    push_priority = task.priority
    if kind == "urgent" and push_priority in {"medium", "low", "lowest"}:
        push_priority = "high"
    issuetype = (
        {"id": conn.default_issuetype_id}
        if conn.default_issuetype_id
        else {"name": conn.default_issuetype_name or "Task"}
    )
    fields: dict = {
        "project": {"key": conn.default_project_key},
        "issuetype": issuetype,
        "summary": task.title,
        "description": with_markers(
            (
                f"Repo: {task.repo_name}\n\n{task.description or ''}".strip()
                if getattr(task, "repo_name", None)
                else task.description
            ),
            task.id,
            extra_names,
            reproduction_steps=getattr(task, "reproduction_steps", None),
            screenshot_url=getattr(task, "screenshot_url", None),
        ),
        "labels": labels,
        "priority": {"name": priority_to_jira(push_priority)},
    }
    if task.due_date:
        fields["duedate"] = task.due_date.isoformat()
    if primary_name:
        fields["assignee"] = {"name": primary_name}
    estimate = minutes_to_jira(task.estimate_minutes)
    if estimate:
        fields["timetracking"] = {"originalEstimate": estimate}
    return fields, primary_name


def _minimal_create_fields(fields: dict) -> dict:
    """Keep only fields that almost every Jira project accepts so local tasks survive."""
    keep = ("project", "issuetype", "summary", "description", "labels")
    return {key: fields[key] for key in keep if key in fields}


def _is_required_field_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(
        token in message
        for token in (
            "is required",
            "required field",
            "cannot be null",
            "cannot be empty",
            "field '",
            "timetracking",
            "duedate",
            "assignee",
            "priority",
            "originalestimate",
        )
    )


def _fingerprint(task: Task, labels: list[str], assignee_username: str | None) -> str:
    return task_fingerprint(
        title=task.title,
        description=task.description,
        due=task.due_date,
        priority=task.priority,
        status=task.status,
        estimate_minutes=task.estimate_minutes,
        assignee_username=assignee_username,
        labels=labels,
    )


async def _mark_synced(session: AsyncSession, task: Task, assignee_username: str | None) -> None:
    _people_rows, labels = await _people(session, task)
    task.sync_fingerprint = _fingerprint(task, labels, assignee_username)
    task.jira_sync_status = "synced"
    task.jira_sync_error = None
    task.jira_last_synced_at = _now()
    task.sync_origin = "remo"
    TaskRepository(session).add_event(task.id, "synced", task.jira_issue_key, None)


async def _align_status(client: JiraClient, task: Task, conn: JiraConnection, key: str) -> None:
    current = await client.get_issue(key)
    fields = current.get("fields") or {}
    task.jira_remote_updated = parse_jira_datetime(fields.get("updated"))
    jira_status = fields.get("status") or {}
    remote_status_id = str(jira_status.get("id") or "") or None
    remote_status_name = jira_status.get("name")
    task.jira_status_id = remote_status_id
    task.jira_status_name = remote_status_name
    remote_column = _column_name(conn, remote_status_id, remote_status_name)
    if remote_column:
        task.board_column = remote_column
    remote_status = remo_status_from_jira(remote_status_name, conn.status_map)
    target_column = _find_column(conn, name=task.board_column) if task.board_column else None
    if target_column and remote_column == target_column.get("name"):
        task.status = remote_status
        return
    if not target_column and remote_status == task.status:
        return
    transitions = await client.transitions(key)
    transition_id = pick_transition_to_column(transitions, target_column) if target_column else None
    if transition_id is None:
        transition_id = pick_transition(transitions, task.status, conn.status_map)
    if transition_id is None:
        target = task.board_column or task.status
        raise JiraError(409, f"No Jira transition from '{remote_status_name}' to {target}")
    await client.transition(key, transition_id)
    refreshed = await client.get_issue(key)
    refreshed_fields = refreshed.get("fields") or {}
    refreshed_status = refreshed_fields.get("status") or {}
    task.jira_remote_updated = parse_jira_datetime(refreshed_fields.get("updated"))
    task.jira_status_id = str(refreshed_status.get("id") or "") or None
    task.jira_status_name = refreshed_status.get("name")
    task.board_column = _column_name(conn, task.jira_status_id, task.jira_status_name) or task.board_column
    task.status = remo_status_from_jira(task.jira_status_name, conn.status_map)


async def _after_write(client: JiraClient, session: AsyncSession, task: Task, conn: JiraConnection, key: str) -> None:
    try:
        people, _labels = await _people(session, task)
        for user in people[1:]:
            await client.add_watcher(key, await _jira_username(session, user))
    except Exception:
        logger.info("Jira watcher update skipped for %s", key, exc_info=True)
    app_base = (settings.PUBLIC_APP_URL or "").rstrip("/")
    if app_base:
        try:
            await client.add_remote_link(
                key,
                f"{app_base}/tasks/{task.id}",
                "Open in Remo",
                f"remo-task-{task.id}",
            )
        except Exception:
            logger.info("Jira remote link skipped for %s", key, exc_info=True)


async def push_create(session: AsyncSession, task_id: uuid.UUID) -> None:
    task = await session.get(Task, task_id)
    conn = await get_connection(session)
    if task is None or conn is None:
        return
    fields, primary_name = await _fields(session, task, conn)
    label = remo_id_label(task.id)
    jql = f'project = "{conn.default_project_key}" AND labels = "{label}" ORDER BY created ASC'
    async with _client_for(conn) as client:
        found = await client.search(jql, max_results=1)
        issues = found.get("issues") or []
        if issues:
            created = issues[0]
        else:
            try:
                created = await client.create_issue(fields)
            except JiraError as exc:
                # Required custom/optional fields must not erase the Remo task — retry minimal.
                if exc.status_code == 400 and _is_required_field_error(exc):
                    logger.warning("Jira create retry with minimal fields for %s: %s", task_id, exc)
                    created = await client.create_issue(_minimal_create_fields(fields))
                    TaskRepository(session).add_event(
                        task.id,
                        "sync_warning",
                        f"Created with minimal Jira fields after: {str(exc)[:200]}",
                        None,
                    )
                else:
                    raise
        key = created["key"]
        task.jira_issue_id = str(created["id"])
        task.jira_issue_key = key
        task.jira_url = issue_url(conn.base_url, key)
        try:
            await _align_status(client, task, conn, key)
        except Exception as exc:
            logger.warning("Jira status align skipped after create for %s: %s", key, exc)
        await _after_write(client, session, task, conn, key)
    await _mark_synced(session, task, primary_name)


async def push_update(session: AsyncSession, task_id: uuid.UUID) -> None:
    task = await session.get(Task, task_id)
    if task is None:
        return
    if not task.jira_issue_key:
        await push_create(session, task_id)
        return
    conn = await get_connection(session)
    if conn is None:
        return
    fields, primary_name = await _fields(session, task, conn)
    fields.pop("project", None)
    fields.pop("issuetype", None)
    async with _client_for(conn) as client:
        try:
            await client.update_issue(task.jira_issue_key, fields)
        except JiraError as exc:
            if exc.status_code == 400 and _is_required_field_error(exc):
                logger.warning("Jira update retry without optional fields for %s: %s", task_id, exc)
                slim = {
                    key: fields[key]
                    for key in ("summary", "description", "labels")
                    if key in fields
                }
                await client.update_issue(task.jira_issue_key, slim)
                TaskRepository(session).add_event(
                    task.id,
                    "sync_warning",
                    f"Updated core fields only after: {str(exc)[:200]}",
                    None,
                )
            else:
                raise
        try:
            await _align_status(client, task, conn, task.jira_issue_key)
        except Exception as exc:
            logger.warning("Jira status align skipped after update for %s: %s", task.jira_issue_key, exc)
        await _after_write(client, session, task, conn, task.jira_issue_key)
    await _mark_synced(session, task, primary_name)


async def push_transition(session: AsyncSession, task_id: uuid.UUID) -> None:
    task = await session.get(Task, task_id)
    if task is None:
        return
    if not task.jira_issue_key:
        await push_create(session, task_id)
        return
    conn = await get_connection(session)
    if conn is None:
        return
    _fields_body, primary_name = await _fields(session, task, conn)
    async with _client_for(conn) as client:
        await _align_status(client, task, conn, task.jira_issue_key)
    await _mark_synced(session, task, primary_name)


async def execute_job(session: AsyncSession, job_id: uuid.UUID) -> None:
    job = await session.get(JiraSyncJob, job_id)
    if job is None or job.status == "done":
        return
    job.status = "running"
    job.attempts = (job.attempts or 0) + 1
    job.updated_at = _now()
    await session.commit()
    try:
        if job.job_type == "push_transition":
            await push_transition(session, job.task_id)  # type: ignore[arg-type]
        elif job.job_type == "push_update":
            await push_update(session, job.task_id)  # type: ignore[arg-type]
        else:
            await push_create(session, job.task_id)  # type: ignore[arg-type]
        job = await session.get(JiraSyncJob, job_id)
        if job is not None:
            job.status = "done"
            job.error = None
            job.updated_at = _now()
        await session.commit()
    except Exception as exc:
        logger.exception("Jira push failed for job %s", job_id)
        await session.rollback()
        message = str(exc)[:500]
        job = await session.get(JiraSyncJob, job_id)
        if job is None:
            return
        job.status = "error"
        job.error = message
        job.updated_at = _now()
        if job.task_id:
            task = await session.get(Task, job.task_id)
            if task is not None:
                task.jira_sync_status = "error"
                task.jira_sync_error = message
                TaskRepository(session).add_event(task.id, "sync_error", message, None)
        await session.commit()


async def _run_detached(job_id: uuid.UUID) -> None:
    from app.core.database import async_session_maker

    async with async_session_maker() as session:
        try:
            await execute_job(session, job_id)
        except Exception:
            logger.exception("Detached Jira job %s failed", job_id)


async def schedule_push(session: AsyncSession, task_id: uuid.UUID, job_type: str) -> None:
    task = await session.get(Task, task_id)
    if task is None:
        return
    conn = await get_connection(session)
    if conn is None:
        task.jira_sync_status = "not_configured"
        task.jira_sync_error = None
        await session.commit()
        return
    task.jira_sync_status = "pending"
    task.jira_sync_error = None
    task.sync_origin = "remo"
    job = JiraSyncJob(task_id=task.id, job_type=job_type, status="pending", attempts=0, created_at=_now(), updated_at=_now())
    session.add(job)
    await session.commit()
    await session.refresh(job)
    if os.getenv("JIRA_SYNC_INLINE") == "1":
        await execute_job(session, job.id)
        return
    if os.getenv("JIRA_SYNC_BACKGROUND", "1") == "0":
        return
    asyncio.create_task(_run_detached(job.id))


async def resolve_jira_user(session: AsyncSession, jira_user: dict | None) -> tuple[uuid.UUID | None, str | None]:
    if not jira_user:
        return None, None
    name = (jira_user.get("name") or jira_user.get("key") or "").strip()
    if not name:
        return None, None
    result = await session.execute(select(JiraUserMap).where(func.lower(JiraUserMap.jira_username) == name.lower()))
    mapping = result.scalar_one_or_none()
    display = jira_user.get("displayName")
    email = jira_user.get("emailAddress")
    if mapping is None:
        mapping = JiraUserMap(
            jira_username=name,
            jira_display_name=display,
            jira_email=email,
            updated_at=_now(),
        )
        session.add(mapping)
        await session.flush()
    else:
        if display:
            mapping.jira_display_name = display
        if email:
            mapping.jira_email = email
        mapping.updated_at = _now()
    if mapping.remo_user_id:
        return mapping.remo_user_id, name
    user_result = await session.execute(select(User).where(func.lower(User.username) == name.lower()))
    user = user_result.scalar_one_or_none()
    if user is not None:
        mapping.remo_user_id = user.id
        return user.id, name
    return None, name


def _incoming_fingerprint(fields: dict, status_map: dict | None) -> tuple[str, str, str, int | None]:
    status_name = (fields.get("status") or {}).get("name")
    status = remo_status_from_jira(status_name, status_map)
    priority = jira_priority_to_remo((fields.get("priority") or {}).get("name"))
    tracking = fields.get("timetracking") or {}
    estimate = jira_estimate_to_minutes(tracking.get("originalEstimate"), tracking.get("originalEstimateSeconds"))
    due = parse_due(fields.get("duedate"))
    assignee_name = ((fields.get("assignee") or {}).get("name") or "")
    labels = list(fields.get("labels") or [])
    fingerprint = task_fingerprint(
        title=fields.get("summary"),
        description=fields.get("description"),
        due=due,
        priority=priority,
        status=status,
        estimate_minutes=estimate,
        assignee_username=assignee_name,
        labels=labels,
    )
    return fingerprint, status, priority, estimate


async def apply_issue(
    session: AsyncSession,
    issue: dict,
    *,
    event: str,
    sprint_id: int | None = None,
    sprint_name: str | None = None,
) -> Task | None:
    conn = await get_connection(session)
    if conn is None or not issue:
        return None
    fields = issue.get("fields") or {}
    jira_id = str(issue.get("id") or "")
    if not jira_id:
        return None
    key = issue.get("key")
    repo = TaskRepository(session)
    existing = await repo.get_by_jira_id(jira_id)
    if existing is None:
        hinted = extract_task_id(fields.get("description"))
        if hinted is not None:
            existing = await repo.get(hinted)

    project = ((fields.get("project") or {}).get("key") or "").upper()
    if project and project != conn.default_project_key.upper():
        if existing is None or existing.jira_issue_id not in (None, jira_id):
            return None

    if event == "jira:issue_deleted":
        if existing is None:
            return None
        existing.status = "cancelled"
        existing.sync_origin = "jira"
        existing.jira_sync_status = "synced"
        existing.updated_at = _now()
        if key and not existing.jira_issue_key:
            existing.jira_issue_key = key
        existing.jira_issue_id = jira_id
        repo.add_event(existing.id, "status_changed", "cancelled in Jira", None)
        await session.commit()
        return existing

    if not fields.get("summary"):
        return existing

    fingerprint, status, priority, estimate = _incoming_fingerprint(fields, conn.status_map)
    remote_dt = parse_jira_datetime(fields.get("updated")) or _now()
    jira_status = fields.get("status") or {}
    jira_status_id = str(jira_status.get("id") or "") or None
    jira_status_name = jira_status.get("name")
    board_column = _column_name(conn, jira_status_id, jira_status_name)
    issue_sprint_id, issue_sprint_name = _sprint_from_fields(fields, sprint_id, sprint_name)

    if existing is not None and existing.sync_fingerprint and existing.sync_fingerprint == fingerprint:
        existing.jira_issue_id = jira_id
        if key:
            existing.jira_issue_key = key
            existing.jira_url = issue_url(conn.base_url, key)
        existing.jira_remote_updated = remote_dt
        existing.jira_status_id = jira_status_id
        existing.jira_status_name = jira_status_name
        existing.board_column = board_column
        existing.jira_sprint_id = issue_sprint_id
        existing.jira_sprint_name = issue_sprint_name
        existing.jira_last_synced_at = _now()
        if existing.jira_sync_status == "pending":
            existing.jira_sync_status = "synced"
            existing.jira_sync_error = None
        await session.commit()
        return existing

    if (
        existing is not None
        and existing.jira_sync_status == "pending"
        and existing.sync_origin == "remo"
        and existing.updated_at
        and existing.updated_at > remote_dt
    ):
        session.add(
            JiraSyncJob(
                task_id=existing.id,
                job_type="pull_upsert",
                status="done",
                detail="skipped: local update is newer",
                created_at=_now(),
                updated_at=_now(),
            )
        )
        await session.commit()
        return existing

    assignee_id, assignee_name = await resolve_jira_user(session, fields.get("assignee"))
    reporter_id, _reporter_name = await resolve_jira_user(session, fields.get("reporter"))
    if existing is None:
        reporter_id = reporter_id or conn.owner_manager_id or conn.configured_by
        if reporter_id is None:
            return None
        task = Task(
            local_key=await repo.allocate_key(),
            title=(fields.get("summary") or key or "Untitled")[:255],
            reporter_id=reporter_id,
            org_manager_id=conn.owner_manager_id or conn.configured_by,
            source="jira",
            created_at=_now(),
            updated_at=remote_dt,
        )
        session.add(task)
        await session.flush()
        action = "imported"
    else:
        task = existing
        if reporter_id is not None:
            task.reporter_id = reporter_id
        action = "updated"

    raw_description = fields.get("description")
    task.title = (fields.get("summary") or task.title)[:255]
    task.description = strip_markers(raw_description) or None
    task.reproduction_steps = extract_reproduction(raw_description)
    task.screenshot_url = extract_screenshot_url(raw_description)
    task.due_date = parse_due(fields.get("duedate"))
    task.priority = priority
    task.task_type = remo_task_type_from_labels(fields.get("labels") or [])
    # Issues already living in Jira are treated as approved work.
    labels_lower = {(label or "").lower() for label in (fields.get("labels") or [])}
    if "remo-backlog" in labels_lower and "remo-approved" not in labels_lower:
        task.pipeline = "backlog"
        task.approval_status = "pending"
    else:
        task.pipeline = "approved"
        task.approval_status = "approved"
    task.status = status
    task.estimate_minutes = estimate
    task.jira_issue_id = jira_id
    if key:
        task.jira_issue_key = key
        task.jira_url = issue_url(conn.base_url, key)
    task.sync_origin = "jira"
    task.sync_fingerprint = fingerprint
    task.jira_remote_updated = remote_dt
    task.jira_status_id = jira_status_id
    task.jira_status_name = jira_status_name
    task.board_column = board_column
    task.jira_sprint_id = issue_sprint_id
    task.jira_sprint_name = issue_sprint_name
    task.jira_last_synced_at = _now()
    task.updated_at = remote_dt
    task.jira_sync_error = None

    kept_extra: list[uuid.UUID] = []
    if existing is not None:
        for row in await repo.assignees_for([task.id]):
            if row.position > 0 and row.user_id != assignee_id:
                kept_extra.append(row.user_id)
    if assignee_id is not None:
        await repo.replace_assignees(task.id, [assignee_id, *kept_extra])
        task.unmapped_assignee = None
        task.needs_assignment = False
        task.jira_sync_status = "synced"
    else:
        await repo.replace_assignees(task.id, kept_extra)
        task.unmapped_assignee = assignee_name
        task.needs_assignment = not kept_extra
        task.jira_sync_status = "unmapped" if assignee_name else ("synced" if kept_extra else "pending")

    org_id = task.org_manager_id or conn.owner_manager_id or conn.configured_by
    label_ids: list[uuid.UUID] = []
    from app.modules.tasks.service import TaskService

    service = TaskService(session)
    for raw in fields.get("labels") or []:
        if is_remo_marker(str(raw)):
            continue
        label = await service.ensure_label(org_id, str(raw)[:50])
        if label.id not in label_ids:
            label_ids.append(label.id)
    await repo.replace_labels(task.id, label_ids)
    repo.add_event(task.id, action, key, None)
    session.add(
        JiraSyncJob(
            task_id=task.id,
            job_type="pull_upsert",
            status="done",
            detail=event or "pull",
            created_at=_now(),
            updated_at=_now(),
        )
    )
    await session.commit()
    return task


async def handle_webhook(session: AsyncSession, payload: dict) -> dict:
    """Apply Jira webhook payload.

    Atlassian docs: webhook issue shape matches GET issue without expand.
    On Server 8.x some payloads omit timetracking/labels — re-fetch by key/id
    so Remo always maps from the canonical REST fields list.
    """
    issue = payload.get("issue") or {}
    event = payload.get("webhookEvent") or "jira:issue_updated"
    if event != "jira:issue_deleted":
        issue_ref = issue.get("key") or issue.get("id")
        conn = await get_connection(session)
        if conn is not None and issue_ref:
            try:
                async with _client_for(conn) as client:
                    issue = await client.get_issue(str(issue_ref))
            except Exception:
                logger.info("Webhook issue re-fetch failed for %s; using payload body", issue_ref, exc_info=True)
    task = await apply_issue(session, issue, event=event)
    return {"ok": True, "task_id": str(task.id) if task else None}


async def _pull_jql(session: AsyncSession, client: JiraClient, conn: JiraConnection) -> int:
    jql = f'project = "{conn.default_project_key}" AND resolution = Unresolved ORDER BY updated DESC'
    count = 0
    data = await client.search(jql, start_at=0, max_results=100)
    for issue in data.get("issues") or []:
        await apply_issue(session, issue, event="jira:issue_updated")
        count += 1
    return count


async def _pull_sprint(
    session: AsyncSession,
    client: JiraClient,
    sprint_id: int,
    sprint_name: str | None,
) -> int:
    count = 0
    start = 0
    while True:
        data = await client.sprint_issues(sprint_id, start_at=start, max_results=50)
        issues = data.get("issues") or []
        for issue in issues:
            await apply_issue(
                session,
                issue,
                event="jira:issue_updated",
                sprint_id=sprint_id,
                sprint_name=sprint_name,
            )
            count += 1
        total = int(data.get("total") or 0)
        start += len(issues)
        if not issues or start >= total:
            return count


async def pull_recent(session: AsyncSession, *, required: bool = False, sprint_id: int | str | None = None) -> int:
    conn = await get_connection(session)
    if conn is None:
        if required:
            raise HTTPException(status_code=400, detail="Jira is not configured")
        return 0
    count = 0
    async with _client_for(conn) as client:
        if sprint_id:
            target_id = int(sprint_id)
            sprint_name = None
            if conn.board_id:
                for item in await client.sprints(conn.board_id, "active,closed,future"):
                    try:
                        item_id = int(item.get("id"))
                    except (TypeError, ValueError):
                        continue
                    if item_id == target_id:
                        sprint_name = item.get("name")
                        break
            count += await _pull_sprint(session, client, target_id, sprint_name)
        elif conn.board_id:
            active = await client.sprints(conn.board_id, "active")
            if active:
                for sprint in active:
                    try:
                        active_id = int(sprint["id"])
                    except (TypeError, ValueError, KeyError):
                        continue
                    count += await _pull_sprint(session, client, active_id, sprint.get("name"))
            else:
                count += await _pull_jql(session, client, conn)
        else:
            count += await _pull_jql(session, client, conn)
    fresh = await get_connection(session)
    if fresh is not None:
        fresh.last_polled_at = _now()
        await session.commit()
    return count


async def poll_jira() -> None:
    from app.core.database import async_session_maker

    async with async_session_maker() as session:
        try:
            await pull_recent(session)
        except Exception:
            logger.exception("Jira poll failed")


async def link_unmapped(session: AsyncSession, jira_username: str, remo_user_id: uuid.UUID) -> None:
    repo = TaskRepository(session)
    for task in await repo.tasks_with_unmapped(jira_username):
        extra = [row.user_id for row in await repo.assignees_for([task.id]) if row.user_id != remo_user_id]
        await repo.replace_assignees(task.id, [remo_user_id, *extra])
        task.unmapped_assignee = None
        if task.jira_sync_status == "unmapped":
            task.jira_sync_status = "synced"

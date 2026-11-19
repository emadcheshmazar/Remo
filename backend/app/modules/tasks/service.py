import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.uploads import delete_upload, save_upload
from app.modules.tasks.model import Task, TaskAttachment, TaskLabel
from app.modules.tasks.repository import TaskRepository
from app.modules.tasks.schema import (
    AssigneeRead,
    AttachmentRead,
    LabelCreate,
    LabelRead,
    LabelUpdate,
    TaskApproval,
    TaskChildBrief,
    TaskCreate,
    TaskCreateResult,
    TaskDetail,
    TaskEventRead,
    TaskPipeline,
    TaskRead,
    TaskRecurrence,
    TaskUpdate,
    UserBrief,
)
from app.modules.users.model import User
from app.modules.users.repository import UserRepository
from app.shared.dates import current_ets_bounds, tehran_today, tehran_week_bounds
from app.shared.roles import UserRole


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _canonical_status(value: str) -> str:
    folded = value.strip().lower()
    if folded in {"todo", "to do", "open", "backlog"}:
        return "todo"
    if folded in {"done", "resolved", "closed"}:
        return "done"
    if "cancel" in folded:
        return "cancelled"
    return "in_progress"


def _attachment_url(attachment_id: uuid.UUID) -> str:
    return f"/api/v1/tasks/attachments/{attachment_id}/file"


class TaskService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = TaskRepository(session)
        self.users = UserRepository(session)

    async def _org_id(self, actor_id: uuid.UUID, actor_role: str) -> uuid.UUID:
        if actor_role == UserRole.MANAGER:
            return actor_id
        actor = await self.users.get_by_id(actor_id)
        if actor is None:
            return actor_id
        manager_id = await self.users.find_manager_id(actor)
        return manager_id or actor_id

    def _reject_admin(self, actor_role: str) -> None:
        if actor_role == UserRole.ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    async def assignable_users(self, actor_id: uuid.UUID, actor_role: str) -> list[User]:
        self._reject_admin(actor_role)
        actor = await self.users.get_by_id(actor_id)
        if actor is None:
            return []
        if actor_role == UserRole.MEMBER:
            return [actor]
        if actor_role == UserRole.SUPERVISOR:
            reports = await self.users.list_for_supervisor(actor_id)
            return [actor, *reports]
        if actor_role == UserRole.MANAGER:
            team = await self.users.list_for_manager(actor_id)
            return [actor, *team]
        return []

    async def _viewer_ids(self, actor_id: uuid.UUID, actor_role: str) -> list[uuid.UUID]:
        users = await self.assignable_users(actor_id, actor_role)
        return [user.id for user in users]

    def _flags(self, task: Task, actor_id: uuid.UUID, actor_role: str) -> tuple[bool, bool, bool, bool, bool]:
        can_edit = True
        can_retry = actor_role in (UserRole.MANAGER, UserRole.SUPERVISOR)
        can_cancel = actor_role == UserRole.MANAGER or task.reporter_id == actor_id
        can_assign = actor_role in (UserRole.MANAGER, UserRole.SUPERVISOR)
        can_approve = actor_role in (UserRole.MANAGER, UserRole.SUPERVISOR)
        return can_edit, can_retry, can_cancel, can_assign, can_approve

    def _to_attachment(self, row: TaskAttachment) -> AttachmentRead:
        return AttachmentRead(
            id=row.id,
            kind=row.kind,
            filename=row.filename,
            content_type=row.content_type,
            size_bytes=row.size_bytes,
            url=_attachment_url(row.id),
            uploaded_by=row.uploaded_by,
            created_at=row.created_at,
        )

    async def _present_many(
        self,
        tasks: list[Task],
        actor_id: uuid.UUID,
        actor_role: str,
        *,
        with_events: bool = False,
    ) -> list[TaskRead] | list[TaskDetail]:
        if not tasks:
            return []
        ids = [task.id for task in tasks]
        assignee_rows = await self.repo.assignees_for(ids)
        user_ids = {row.user_id for row in assignee_rows} | {task.reporter_id for task in tasks}
        users_by_id: dict[uuid.UUID, User] = {}
        if user_ids:
            result = await self.session.execute(select(User).where(User.id.in_(user_ids)))
            users_by_id = {user.id: user for user in result.scalars().all()}
        assignees_by_task: dict[uuid.UUID, list[AssigneeRead]] = {task_id: [] for task_id in ids}
        for row in assignee_rows:
            user = users_by_id.get(row.user_id)
            if user is None:
                continue
            assignees_by_task[row.task_id].append(
                AssigneeRead(id=user.id, username=user.username, full_name=user.full_name, position=row.position)
            )
        labels_by_task: dict[uuid.UUID, list[LabelRead]] = {task_id: [] for task_id in ids}
        for link, label in await self.repo.labels_for(ids):
            labels_by_task[link.task_id].append(LabelRead(id=label.id, title=label.title, color=label.color))
        attachments_by_task: dict[uuid.UUID, list[AttachmentRead]] = {task_id: [] for task_id in ids}
        for row in await self.repo.attachments_for(ids):
            attachments_by_task[row.task_id].append(self._to_attachment(row))
        children_by_parent: dict[uuid.UUID, list[TaskChildBrief]] = {task_id: [] for task_id in ids}
        for child in await self.repo.children_for(ids):
            children_by_parent.setdefault(child.parent_task_id, []).append(  # type: ignore[arg-type]
                TaskChildBrief(
                    id=child.id,
                    key=child.jira_issue_key or child.local_key,
                    title=child.title,
                    status=child.status,
                    approval_status=child.approval_status or TaskApproval.pending,
                    pipeline=child.pipeline or TaskPipeline.backlog,
                )
            )
        parent_ids = {task.parent_task_id for task in tasks if task.parent_task_id}
        parents_by_id: dict[uuid.UUID, Task] = {}
        if parent_ids:
            parent_result = await self.session.execute(select(Task).where(Task.id.in_(parent_ids)))
            parents_by_id = {row.id: row for row in parent_result.scalars().all()}
        approver_ids = {task.approved_by for task in tasks if task.approved_by}
        for approver_id in approver_ids - set(users_by_id):
            if approver_id is None:
                continue
            user = await self.users.get_by_id(approver_id)
            if user:
                users_by_id[user.id] = user

        presented: list[TaskRead] = []
        for task in tasks:
            reporter = users_by_id.get(task.reporter_id)
            can_edit, can_retry, can_cancel, can_assign, can_approve = self._flags(task, actor_id, actor_role)
            parent = parents_by_id.get(task.parent_task_id) if task.parent_task_id else None
            approver = users_by_id.get(task.approved_by) if task.approved_by else None
            payload = dict(
                id=task.id,
                key=task.jira_issue_key or task.local_key,
                local_key=task.local_key,
                title=task.title,
                description=task.description,
                estimate_minutes=task.estimate_minutes,
                due_date=task.due_date,
                priority=task.priority,
                task_type=task.task_type or "sprint",
                needs_assignment=bool(task.needs_assignment),
                pipeline=task.pipeline or TaskPipeline.backlog,
                approval_status=task.approval_status or TaskApproval.pending,
                approved_by=task.approved_by,
                approved_by_name=approver.full_name if approver else None,
                approved_at=task.approved_at,
                parent_task_id=task.parent_task_id,
                parent_key=(parent.jira_issue_key or parent.local_key) if parent else None,
                parent_title=parent.title if parent else None,
                repo_name=task.repo_name,
                reproduction_steps=task.reproduction_steps,
                screenshot_url=task.screenshot_url,
                recurrence=task.recurrence or TaskRecurrence.none,
                recurrence_until=task.recurrence_until,
                status=task.status,
                reporter_id=task.reporter_id,
                reporter_name=reporter.full_name if reporter else "",
                assignees=assignees_by_task.get(task.id, []),
                labels=labels_by_task.get(task.id, []),
                attachments=attachments_by_task.get(task.id, []),
                children=children_by_parent.get(task.id, []),
                unmapped_assignee=task.unmapped_assignee,
                source=task.source,
                jira_issue_key=task.jira_issue_key,
                jira_sync_status=task.jira_sync_status,
                jira_sync_error=task.jira_sync_error,
                jira_url=task.jira_url,
                jira_status_id=task.jira_status_id,
                jira_status_name=task.jira_status_name,
                board_column=task.board_column,
                jira_sprint_id=task.jira_sprint_id,
                jira_sprint_name=task.jira_sprint_name,
                jira_last_synced_at=task.jira_last_synced_at,
                created_at=task.created_at,
                updated_at=task.updated_at,
                can_edit=can_edit,
                can_retry_sync=can_retry,
                can_cancel=can_cancel,
                can_assign=can_assign,
                can_approve=can_approve,
            )
            if with_events:
                events = [
                    TaskEventRead(
                        id=event.id,
                        action=event.action,
                        detail=event.detail,
                        actor_id=event.actor_id,
                        created_at=event.created_at,
                    )
                    for event in await self.repo.events_for(task.id)
                ]
                presented.append(TaskDetail(**payload, events=events))
            else:
                presented.append(TaskRead(**payload))
        return presented

    async def _require_visible(self, task_id: uuid.UUID, actor_id: uuid.UUID, actor_role: str) -> Task:
        self._reject_admin(actor_role)
        viewer_ids = await self._viewer_ids(actor_id, actor_role)
        include_org = actor_role == UserRole.MANAGER
        org_id = await self._org_id(actor_id, actor_role)
        task = await self.repo.visible_ids(
            task_id, viewer_ids, org_manager_id=org_id, include_org=include_org
        )
        if task is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        return task

    async def _assert_assignees(self, actor_id: uuid.UUID, actor_role: str, assignee_ids: list[uuid.UUID]) -> None:
        if not assignee_ids:
            return
        allowed = {user.id for user in await self.assignable_users(actor_id, actor_role)}
        if any(user_id not in allowed for user_id in assignee_ids):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Assignee is outside your team")

    async def _assert_labels(self, org_id: uuid.UUID, label_ids: list[uuid.UUID]) -> None:
        if not label_ids:
            return
        result = await self.session.execute(select(TaskLabel).where(TaskLabel.id.in_(label_ids)))
        found = {label.id: label for label in result.scalars().all()}
        if len(found) != len(set(label_ids)):
            raise HTTPException(status_code=404, detail="Label not found")
        if any(label.org_manager_id != org_id for label in found.values()):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Label is outside your organization")

    async def list_tasks(
        self,
        actor_id: uuid.UUID,
        actor_role: str,
        *,
        scope: str,
        status_filter: str | None,
        priority: str | None,
        task_type: str | None,
        due: str | None,
        pipeline: str | None,
        label_id: uuid.UUID | None,
        unsynced: bool,
        needs_assignment: bool | None,
        parent_task_id: uuid.UUID | None,
        roots_only: bool,
        assignee_id: uuid.UUID | None,
        q: str | None,
    ) -> list[TaskRead]:
        self._reject_admin(actor_role)
        if scope == "inbox" and actor_role not in (UserRole.MANAGER, UserRole.SUPERVISOR):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inbox is for supervisors")
        viewer_ids = await self._viewer_ids(actor_id, actor_role)
        if assignee_id is not None and assignee_id not in viewer_ids:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Assignee is outside your team")
        today = tehran_today()
        due_from = due_to = None
        overdue_before = None
        hot = False
        if due == "today":
            due_from = due_to = today
        elif due == "week":
            due_from, due_to = tehran_week_bounds(today)
        elif due == "ets":
            due_from, due_to = current_ets_bounds(today)
        elif due == "overdue":
            overdue_before = today
        elif due == "hot":
            hot = True
            overdue_before = today
        include_org = actor_role == UserRole.MANAGER
        org_id = await self._org_id(actor_id, actor_role)
        inbox_only = True if scope == "inbox" else needs_assignment
        tasks = await self.repo.list_visible(
            viewer_ids,
            org_manager_id=org_id,
            include_org=include_org,
            actor_id=actor_id,
            scope=scope,
            status=status_filter,
            priority=priority,
            task_type=task_type,
            needs_assignment=inbox_only,
            pipeline=pipeline,
            label_id=label_id,
            unsynced=unsynced,
            due_from=due_from,
            due_to=due_to,
            overdue_before=overdue_before,
            hot=hot,
            parent_task_id=parent_task_id,
            roots_only=roots_only,
            assignee_id=assignee_id,
            q=q,
        )
        if due == "today":
            tasks = [task for task in tasks if task.status != "cancelled"]
        presented = await self._present_many(tasks, actor_id, actor_role)
        return presented  # type: ignore[return-value]

    async def get_task(self, task_id: uuid.UUID, actor_id: uuid.UUID, actor_role: str) -> TaskDetail:
        task = await self._require_visible(task_id, actor_id, actor_role)
        presented = await self._present_many([task], actor_id, actor_role, with_events=True)
        return presented[0]  # type: ignore[return-value]

    def _next_due(self, current: date | None, recurrence: str) -> date | None:
        base = current or tehran_today()
        if recurrence == TaskRecurrence.daily:
            return base + timedelta(days=1)
        if recurrence == TaskRecurrence.weekly:
            return base + timedelta(days=7)
        if recurrence == TaskRecurrence.monthly:
            month = base.month + 1
            year = base.year
            if month > 12:
                month = 1
                year += 1
            day = min(base.day, 28)
            return date(year, month, day)
        return None

    async def _create_one(
        self,
        data: TaskCreate,
        actor_id: uuid.UUID,
        org_id: uuid.UUID,
        assignee_ids: list[uuid.UUID],
        *,
        needs_assignment: bool,
    ) -> Task:
        due = data.due_date
        if due is None and data.task_type == "urgent":
            due = tehran_today()
        auto = bool(data.auto_approve)
        pipeline = TaskPipeline.approved if auto else TaskPipeline.backlog
        approval = TaskApproval.approved if auto else TaskApproval.pending
        task = Task(
            local_key=await self.repo.allocate_key(),
            title=data.title,
            description=(data.description or "").strip() or None,
            estimate_minutes=data.estimate_minutes,
            due_date=due,
            priority=data.priority if data.task_type != "urgent" or data.priority != "medium" else "high",
            task_type=data.task_type,
            needs_assignment=needs_assignment,
            pipeline=pipeline,
            approval_status=approval,
            approved_by=actor_id if auto else None,
            approved_at=_now() if auto else None,
            parent_task_id=data.parent_task_id,
            repo_name=(data.repo_name or "").strip() or None,
            reproduction_steps=(data.reproduction_steps or "").strip() or None,
            screenshot_url=(data.screenshot_url or "").strip() or None,
            recurrence=data.recurrence or TaskRecurrence.none,
            recurrence_until=data.recurrence_until,
            status="todo",
            reporter_id=actor_id,
            org_manager_id=org_id,
            source="remo",
            sync_origin="remo",
            jira_sync_status="pending",
            created_at=_now(),
            updated_at=_now(),
        )
        self.session.add(task)
        await self.session.flush()
        await self.repo.replace_assignees(task.id, assignee_ids)
        await self.repo.replace_labels(task.id, data.label_ids)
        detail = f"{data.task_type}: {data.title}"
        if needs_assignment:
            detail += " (needs assignment)"
        elif assignee_ids:
            detail += f" → {len(assignee_ids)} assignee"
        self.repo.add_event(task.id, "created", detail, actor_id)
        return task

    async def _assert_parent(
        self, parent_task_id: uuid.UUID | None, actor_id: uuid.UUID, actor_role: str
    ) -> None:
        if parent_task_id is None:
            return
        parent = await self._require_visible(parent_task_id, actor_id, actor_role)
        if parent.parent_task_id is not None:
            raise HTTPException(status_code=422, detail="Subtasks cannot have their own subtasks")

    async def create_task(self, data: TaskCreate, actor_id: uuid.UUID, actor_role: str) -> TaskCreateResult:
        self._reject_admin(actor_role)
        assignee_ids = list(dict.fromkeys(data.assignee_ids))
        org_id = await self._org_id(actor_id, actor_role)
        await self._assert_labels(org_id, data.label_ids)
        await self._assert_parent(data.parent_task_id, actor_id, actor_role)

        if actor_role == UserRole.MEMBER:
            if not assignee_ids:
                assignee_ids = [actor_id]
            if assignee_ids != [actor_id]:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Members can only assign themselves")
            await self._assert_assignees(actor_id, actor_role, assignee_ids)
            # Members own their work — auto-approve into pipeline.
            data = data.model_copy(update={"auto_approve": True})
            task = await self._create_one(data, actor_id, org_id, assignee_ids, needs_assignment=False)
            await self.session.commit()
            from app.modules.jira.sync import schedule_push

            await schedule_push(self.session, task.id, "push_create")
            return TaskCreateResult(tasks=[await self.get_task(task.id, actor_id, actor_role)])

        if not assignee_ids:
            # Supervisor/manager inbox: leave unassigned for later assignment.
            task = await self._create_one(data, actor_id, org_id, [], needs_assignment=True)
            await self.session.commit()
            from app.modules.jira.sync import schedule_push

            await schedule_push(self.session, task.id, "push_create")
            return TaskCreateResult(tasks=[await self.get_task(task.id, actor_id, actor_role)])

        await self._assert_assignees(actor_id, actor_role, assignee_ids)
        # Meeting rule: one person per task — create N tasks when N people selected.
        created_ids: list[uuid.UUID] = []
        for user_id in assignee_ids:
            task = await self._create_one(data, actor_id, org_id, [user_id], needs_assignment=False)
            created_ids.append(task.id)
        await self.session.commit()
        from app.modules.jira.sync import schedule_push

        for task_id in created_ids:
            await schedule_push(self.session, task_id, "push_create")
        details = [await self.get_task(task_id, actor_id, actor_role) for task_id in created_ids]
        return TaskCreateResult(tasks=details)

    async def update_task(
        self, task_id: uuid.UUID, data: TaskUpdate, actor_id: uuid.UUID, actor_role: str
    ) -> TaskDetail:
        task = await self._require_visible(task_id, actor_id, actor_role)
        org_id = task.org_manager_id or await self._org_id(actor_id, actor_role)
        changes: list[str] = []

        if data.assignee_ids is not None:
            assignee_ids = list(dict.fromkeys(data.assignee_ids))
            if actor_role == UserRole.MEMBER:
                if assignee_ids != [actor_id]:
                    raise HTTPException(status_code=403, detail="Members can only assign themselves")
            if len(assignee_ids) > 1:
                raise HTTPException(
                    status_code=422,
                    detail="A task has one assignee. Create separate tasks for more people.",
                )
            if len(assignee_ids) < 1:
                if actor_role not in (UserRole.MANAGER, UserRole.SUPERVISOR):
                    raise HTTPException(status_code=422, detail="At least one assignee is required")
                await self.repo.replace_assignees(task.id, [])
                task.needs_assignment = True
                changes.append("assignee → unassigned")
            else:
                await self._assert_assignees(actor_id, actor_role, assignee_ids)
                await self.repo.replace_assignees(task.id, assignee_ids)
                task.needs_assignment = False
                task.unmapped_assignee = None
                changes.append(f"assignee → {assignee_ids[0]}")

        if data.label_ids is not None:
            await self._assert_labels(org_id, data.label_ids)
            await self.repo.replace_labels(task.id, data.label_ids)
            changes.append("labels updated")
        if data.title is not None and data.title != task.title:
            changes.append(f"title: {task.title} → {data.title}")
            task.title = data.title
        if data.description is not None:
            new_desc = data.description.strip() or None
            if new_desc != task.description:
                changes.append("description updated")
                task.description = new_desc
        if data.estimate_minutes is not None and data.estimate_minutes != task.estimate_minutes:
            changes.append(f"estimate: {task.estimate_minutes} → {data.estimate_minutes}")
            task.estimate_minutes = data.estimate_minutes
        if data.due_date is not None and data.due_date != task.due_date:
            changes.append(f"due: {task.due_date} → {data.due_date}")
            task.due_date = data.due_date
        if data.priority is not None and data.priority != task.priority:
            changes.append(f"priority: {task.priority} → {data.priority}")
            task.priority = data.priority
        if data.task_type is not None and data.task_type != task.task_type:
            changes.append(f"type: {task.task_type} → {data.task_type}")
            task.task_type = data.task_type
        if data.reproduction_steps is not None:
            new_repro = data.reproduction_steps.strip() or None
            if new_repro != task.reproduction_steps:
                changes.append("reproduction steps updated")
                task.reproduction_steps = new_repro
        if data.screenshot_url is not None:
            new_url = data.screenshot_url.strip() or None
            if new_url != task.screenshot_url:
                changes.append("screenshot url updated")
                task.screenshot_url = new_url
        if data.recurrence is not None and data.recurrence != task.recurrence:
            changes.append(f"recurrence: {task.recurrence} → {data.recurrence}")
            task.recurrence = data.recurrence
        if data.recurrence_until is not None and data.recurrence_until != task.recurrence_until:
            changes.append(f"recurrence until: {task.recurrence_until} → {data.recurrence_until}")
            task.recurrence_until = data.recurrence_until
        if data.repo_name is not None:
            new_repo = data.repo_name.strip() or None
            if new_repo != task.repo_name:
                changes.append(f"repo: {task.repo_name} → {new_repo}")
                task.repo_name = new_repo
        if "parent_task_id" in data.model_fields_set:
            new_parent = data.parent_task_id
            if new_parent != task.parent_task_id:
                if new_parent == task.id:
                    raise HTTPException(status_code=422, detail="Task cannot be its own parent")
                await self._assert_parent(new_parent, actor_id, actor_role)
                if new_parent is not None:
                    for child in await self.repo.children_for([task.id]):
                        if child.id == new_parent:
                            raise HTTPException(status_code=422, detail="Cannot nest under a child task")
                changes.append(f"parent → {new_parent}")
                task.parent_task_id = new_parent

        task.updated_at = _now()
        task.sync_origin = "remo"
        self.repo.add_event(task.id, "updated", "; ".join(changes) if changes else None, actor_id)
        await self.session.commit()
        from app.modules.jira.sync import schedule_push

        await schedule_push(self.session, task.id, "push_update")
        return await self.get_task(task.id, actor_id, actor_role)

    async def set_approval(
        self, task_id: uuid.UUID, approve: bool, actor_id: uuid.UUID, actor_role: str
    ) -> TaskDetail:
        if actor_role not in (UserRole.MANAGER, UserRole.SUPERVISOR):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        task = await self._require_visible(task_id, actor_id, actor_role)
        if approve:
            if task.needs_assignment:
                raise HTTPException(status_code=422, detail="Assign someone before approving")
            task.pipeline = TaskPipeline.approved
            task.approval_status = TaskApproval.approved
            task.approved_by = actor_id
            task.approved_at = _now()
            self.repo.add_event(task.id, "approved", None, actor_id)
        else:
            task.pipeline = TaskPipeline.backlog
            task.approval_status = TaskApproval.pending
            task.approved_by = None
            task.approved_at = None
            self.repo.add_event(task.id, "approval_revoked", None, actor_id)
        task.updated_at = _now()
        task.sync_origin = "remo"
        await self.session.commit()
        from app.modules.jira.sync import schedule_push

        await schedule_push(self.session, task.id, "push_update")
        return await self.get_task(task.id, actor_id, actor_role)

    async def add_attachment(
        self, task_id: uuid.UUID, upload: UploadFile, actor_id: uuid.UUID, actor_role: str
    ) -> AttachmentRead:
        task = await self._require_visible(task_id, actor_id, actor_role)
        try:
            kind, filename, relative, size = await save_upload(task.id, upload)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        row = TaskAttachment(
            task_id=task.id,
            uploaded_by=actor_id,
            kind=kind,
            filename=filename,
            content_type=upload.content_type,
            size_bytes=size,
            storage_path=relative,
            created_at=_now(),
        )
        self.session.add(row)
        task.updated_at = _now()
        self.repo.add_event(task.id, "attachment_added", f"{kind}: {filename}", actor_id)
        await self.session.commit()
        await self.session.refresh(row)
        return self._to_attachment(row)

    async def delete_attachment(
        self, attachment_id: uuid.UUID, actor_id: uuid.UUID, actor_role: str
    ) -> None:
        row = await self.repo.get_attachment(attachment_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Attachment not found")
        task = await self._require_visible(row.task_id, actor_id, actor_role)
        delete_upload(row.storage_path)
        await self.session.delete(row)
        task.updated_at = _now()
        self.repo.add_event(task.id, "attachment_removed", row.filename, actor_id)
        await self.session.commit()

    async def get_attachment_file(
        self, attachment_id: uuid.UUID, actor_id: uuid.UUID, actor_role: str
    ) -> TaskAttachment:
        row = await self.repo.get_attachment(attachment_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Attachment not found")
        await self._require_visible(row.task_id, actor_id, actor_role)
        return row

    async def _spawn_recurrence(
        self, task: Task, actor_id: uuid.UUID, assignee_ids: list[uuid.UUID]
    ) -> Task | None:
        recurrence = (task.recurrence or TaskRecurrence.none).lower()
        if recurrence == TaskRecurrence.none:
            return None
        next_due = self._next_due(task.due_date, recurrence)
        if next_due is None:
            return None
        if task.recurrence_until is not None and next_due > task.recurrence_until:
            return None
        child = Task(
            local_key=await self.repo.allocate_key(),
            title=task.title,
            description=task.description,
            estimate_minutes=task.estimate_minutes,
            due_date=next_due,
            priority=task.priority,
            task_type=task.task_type,
            needs_assignment=task.needs_assignment and not assignee_ids,
            pipeline=TaskPipeline.backlog,
            approval_status=TaskApproval.pending,
            parent_task_id=None,
            repo_name=task.repo_name,
            reproduction_steps=task.reproduction_steps,
            screenshot_url=task.screenshot_url,
            recurrence=task.recurrence,
            recurrence_until=task.recurrence_until,
            status="todo",
            reporter_id=task.reporter_id,
            org_manager_id=task.org_manager_id,
            source="remo",
            sync_origin="remo",
            jira_sync_status="pending",
            created_at=_now(),
            updated_at=_now(),
        )
        self.session.add(child)
        await self.session.flush()
        await self.repo.replace_assignees(child.id, assignee_ids)
        label_ids = [label.id for _link, label in await self.repo.labels_for([task.id])]
        await self.repo.replace_labels(child.id, label_ids)
        self.repo.add_event(
            child.id,
            "created",
            f"recurrence from {task.local_key} → due {next_due}",
            actor_id,
        )
        self.repo.add_event(task.id, "recurrence_spawned", child.local_key, actor_id)
        return child

    async def transition(
        self, task_id: uuid.UUID, new_status: str, actor_id: uuid.UUID, actor_role: str
    ) -> TaskDetail:
        task = await self._require_visible(task_id, actor_id, actor_role)
        next_value = new_status.strip()
        next_status = next_value if next_value in ("todo", "in_progress", "done", "cancelled") else _canonical_status(next_value)
        spawned: Task | None = None
        if task.status != next_status or task.board_column != next_value:
            previous = task.board_column or task.status
            becoming_done = next_status == "done" and task.status != "done"
            task.status = next_status
            task.board_column = None if next_value == next_status else next_value
            task.updated_at = _now()
            task.sync_origin = "remo"
            self.repo.add_event(task.id, "status_changed", f"{previous} → {next_value}", actor_id)
            if becoming_done:
                assignee_rows = await self.repo.assignees_for([task.id])
                assignee_ids = [row.user_id for row in assignee_rows]
                spawned = await self._spawn_recurrence(task, actor_id, assignee_ids)
            await self.session.commit()
            from app.modules.jira.sync import schedule_push

            await schedule_push(self.session, task.id, "push_transition")
            if spawned is not None:
                await schedule_push(self.session, spawned.id, "push_create")
        return await self.get_task(task.id, actor_id, actor_role)

    async def cancel(self, task_id: uuid.UUID, actor_id: uuid.UUID, actor_role: str) -> TaskDetail:
        task = await self._require_visible(task_id, actor_id, actor_role)
        if actor_role != UserRole.MANAGER and task.reporter_id != actor_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return await self.transition(task_id, "cancelled", actor_id, actor_role)

    async def retry_sync(self, task_id: uuid.UUID, actor_id: uuid.UUID, actor_role: str) -> TaskDetail:
        if actor_role not in (UserRole.MANAGER, UserRole.SUPERVISOR):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        task = await self._require_visible(task_id, actor_id, actor_role)
        from app.modules.jira.sync import schedule_push

        job_type = "push_update" if task.jira_issue_key else "push_create"
        await schedule_push(self.session, task.id, job_type)
        return await self.get_task(task.id, actor_id, actor_role)

    async def list_labels(self, actor_id: uuid.UUID, actor_role: str) -> list[LabelRead]:
        self._reject_admin(actor_role)
        org_id = await self._org_id(actor_id, actor_role)
        labels = await self.repo.list_labels(org_id)
        return [LabelRead(id=label.id, title=label.title, color=label.color) for label in labels]

    async def create_label(self, data: LabelCreate, actor_id: uuid.UUID, actor_role: str) -> LabelRead:
        if actor_role not in (UserRole.MANAGER, UserRole.SUPERVISOR):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        org_id = await self._org_id(actor_id, actor_role)
        existing = await self.repo.label_by_title(org_id, data.title)
        if existing:
            raise HTTPException(status_code=409, detail="Label already exists")
        label = TaskLabel(org_manager_id=org_id, title=data.title, color=data.color)
        self.session.add(label)
        await self.session.commit()
        await self.session.refresh(label)
        return LabelRead(id=label.id, title=label.title, color=label.color)

    async def update_label(
        self, label_id: uuid.UUID, data: LabelUpdate, actor_id: uuid.UUID, actor_role: str
    ) -> LabelRead:
        if actor_role != UserRole.MANAGER:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        label = await self.repo.get_label(label_id)
        org_id = await self._org_id(actor_id, actor_role)
        if label is None or label.org_manager_id != org_id:
            raise HTTPException(status_code=404, detail="Label not found")
        if data.title is not None:
            title = data.title.strip()
            if not title:
                raise HTTPException(status_code=422, detail="Label title is required")
            label.title = title
        if data.color is not None:
            label.color = data.color
        await self.session.commit()
        await self.session.refresh(label)
        return LabelRead(id=label.id, title=label.title, color=label.color)

    async def delete_label(self, label_id: uuid.UUID, actor_id: uuid.UUID, actor_role: str) -> None:
        if actor_role != UserRole.MANAGER:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        label = await self.repo.get_label(label_id)
        org_id = await self._org_id(actor_id, actor_role)
        if label is None or label.org_manager_id != org_id:
            raise HTTPException(status_code=404, detail="Label not found")
        await self.session.delete(label)
        await self.session.commit()

    async def briefs(self, actor_id: uuid.UUID, actor_role: str) -> list[UserBrief]:
        users = await self.assignable_users(actor_id, actor_role)
        return [
            UserBrief(id=user.id, username=user.username, full_name=user.full_name, role=str(user.role))
            for user in users
        ]

    async def ensure_label(self, org_id: uuid.UUID | None, title: str, color: str = "#64748b") -> TaskLabel:
        existing = await self.repo.label_by_title(org_id, title)
        if existing:
            return existing
        label = TaskLabel(org_manager_id=org_id, title=title[:50], color=color)
        self.session.add(label)
        await self.session.flush()
        return label

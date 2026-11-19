import uuid
from datetime import date

from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tasks.model import (
    Task,
    TaskAssignee,
    TaskAttachment,
    TaskEvent,
    TaskLabel,
    TaskLabelLink,
)


class TaskRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def allocate_key(self) -> str:
        result = await self.session.execute(text("SELECT nextval('task_key_seq')"))
        return f"RW-{int(result.scalar_one())}"

    async def get(self, task_id: uuid.UUID) -> Task | None:
        result = await self.session.execute(select(Task).where(Task.id == task_id))
        return result.scalar_one_or_none()

    async def get_by_jira_id(self, jira_issue_id: str) -> Task | None:
        result = await self.session.execute(select(Task).where(Task.jira_issue_id == jira_issue_id))
        return result.scalar_one_or_none()

    def _scope_clause(
        self,
        viewer_ids: list[uuid.UUID],
        *,
        org_manager_id: uuid.UUID | None,
        include_org: bool,
    ):
        clauses = []
        if viewer_ids:
            assigned = select(TaskAssignee.task_id).where(TaskAssignee.user_id.in_(viewer_ids))
            clauses.append(Task.reporter_id.in_(viewer_ids))
            clauses.append(Task.id.in_(assigned))
            # Unassigned inbox items stay visible to everyone in that org tree.
            if org_manager_id is not None:
                clauses.append(and_(Task.needs_assignment.is_(True), Task.org_manager_id == org_manager_id))
        if include_org and org_manager_id is not None:
            clauses.append(Task.org_manager_id == org_manager_id)
            clauses.append(and_(Task.org_manager_id.is_(None), Task.source == "jira"))
        if not clauses:
            return None
        return or_(*clauses)

    async def list_visible(
        self,
        viewer_ids: list[uuid.UUID],
        *,
        org_manager_id: uuid.UUID | None,
        include_org: bool,
        actor_id: uuid.UUID,
        scope: str,
        status: str | None,
        priority: str | None,
        task_type: str | None,
        needs_assignment: bool | None,
        pipeline: str | None,
        label_id: uuid.UUID | None,
        unsynced: bool,
        due_from: date | None,
        due_to: date | None,
        overdue_before: date | None,
        hot: bool,
        parent_task_id: uuid.UUID | None,
        roots_only: bool,
        assignee_id: uuid.UUID | None,
        q: str | None,
    ) -> list[Task]:
        scope_clause = self._scope_clause(viewer_ids, org_manager_id=org_manager_id, include_org=include_org)
        if scope_clause is None:
            return []
        stmt = select(Task).where(scope_clause)
        if scope == "mine":
            mine = select(TaskAssignee.task_id).where(TaskAssignee.user_id == actor_id)
            stmt = stmt.where(or_(Task.id.in_(mine), Task.reporter_id == actor_id))
        elif scope == "inbox":
            stmt = stmt.where(Task.needs_assignment.is_(True), Task.status.notin_(["done", "cancelled"]))
        if status:
            stmt = stmt.where(Task.status == status)
        if priority:
            stmt = stmt.where(Task.priority == priority)
        if task_type:
            stmt = stmt.where(Task.task_type == task_type)
        if needs_assignment is not None:
            stmt = stmt.where(Task.needs_assignment.is_(needs_assignment))
        if pipeline:
            stmt = stmt.where(Task.pipeline == pipeline)
        if parent_task_id is not None:
            stmt = stmt.where(Task.parent_task_id == parent_task_id)
        elif roots_only:
            stmt = stmt.where(Task.parent_task_id.is_(None))
        if label_id:
            linked = select(TaskLabelLink.task_id).where(TaskLabelLink.label_id == label_id)
            stmt = stmt.where(Task.id.in_(linked))
        if unsynced:
            stmt = stmt.where(Task.jira_sync_status != "synced")
        if hot:
            # Hot queue = urgent OR overdue, still open.
            clauses = [Task.task_type == "urgent"]
            if overdue_before is not None:
                clauses.append(
                    and_(
                        Task.due_date.is_not(None),
                        Task.due_date < overdue_before,
                    )
                )
            stmt = stmt.where(Task.status.notin_(["done", "cancelled"]), or_(*clauses))
        elif overdue_before is not None:
            stmt = stmt.where(
                Task.due_date.is_not(None),
                Task.due_date < overdue_before,
                Task.status.notin_(["done", "cancelled"]),
            )
        else:
            if due_from is not None:
                stmt = stmt.where(Task.due_date.is_not(None), Task.due_date >= due_from)
            if due_to is not None:
                stmt = stmt.where(Task.due_date.is_not(None), Task.due_date <= due_to)
        if assignee_id is not None:
            assigned = select(TaskAssignee.task_id).where(TaskAssignee.user_id == assignee_id)
            stmt = stmt.where(Task.id.in_(assigned))
        if q:
            safe = q.replace("%", "").replace("_", "").strip()
            if safe:
                pattern = f"%{safe}%"
                stmt = stmt.where(
                    or_(
                        Task.title.ilike(pattern),
                        Task.local_key.ilike(pattern),
                        Task.jira_issue_key.ilike(pattern),
                    )
                )
        stmt = stmt.order_by(Task.due_date.asc().nulls_last(), Task.updated_at.desc()).limit(500)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def visible_ids(
        self,
        task_id: uuid.UUID,
        viewer_ids: list[uuid.UUID],
        *,
        org_manager_id: uuid.UUID | None,
        include_org: bool,
    ) -> Task | None:
        scope_clause = self._scope_clause(viewer_ids, org_manager_id=org_manager_id, include_org=include_org)
        if scope_clause is None:
            return None
        result = await self.session.execute(select(Task).where(Task.id == task_id, scope_clause))
        return result.scalar_one_or_none()

    async def assignees_for(self, task_ids: list[uuid.UUID]) -> list[TaskAssignee]:
        if not task_ids:
            return []
        result = await self.session.execute(
            select(TaskAssignee)
            .where(TaskAssignee.task_id.in_(task_ids))
            .order_by(TaskAssignee.position.asc(), TaskAssignee.id.asc())
        )
        return list(result.scalars().all())

    async def replace_assignees(self, task_id: uuid.UUID, user_ids: list[uuid.UUID]) -> None:
        existing = await self.assignees_for([task_id])
        for row in existing:
            await self.session.delete(row)
        await self.session.flush()
        for index, user_id in enumerate(user_ids):
            self.session.add(TaskAssignee(task_id=task_id, user_id=user_id, position=index))

    async def labels_for(self, task_ids: list[uuid.UUID]) -> list[tuple[TaskLabelLink, TaskLabel]]:
        if not task_ids:
            return []
        result = await self.session.execute(
            select(TaskLabelLink, TaskLabel)
            .join(TaskLabel, TaskLabel.id == TaskLabelLink.label_id)
            .where(TaskLabelLink.task_id.in_(task_ids))
        )
        return list(result.all())

    async def replace_labels(self, task_id: uuid.UUID, label_ids: list[uuid.UUID]) -> None:
        result = await self.session.execute(select(TaskLabelLink).where(TaskLabelLink.task_id == task_id))
        for row in result.scalars().all():
            await self.session.delete(row)
        await self.session.flush()
        for label_id in label_ids:
            self.session.add(TaskLabelLink(task_id=task_id, label_id=label_id))

    async def list_labels(self, org_manager_id: uuid.UUID) -> list[TaskLabel]:
        result = await self.session.execute(
            select(TaskLabel)
            .where(TaskLabel.org_manager_id == org_manager_id)
            .order_by(TaskLabel.title.asc())
        )
        return list(result.scalars().all())

    async def get_label(self, label_id: uuid.UUID) -> TaskLabel | None:
        result = await self.session.execute(select(TaskLabel).where(TaskLabel.id == label_id))
        return result.scalar_one_or_none()

    async def label_by_title(self, org_manager_id: uuid.UUID | None, title: str) -> TaskLabel | None:
        stmt = select(TaskLabel).where(func.lower(TaskLabel.title) == title.lower())
        if org_manager_id is None:
            stmt = stmt.where(TaskLabel.org_manager_id.is_(None))
        else:
            stmt = stmt.where(TaskLabel.org_manager_id == org_manager_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def events_for(self, task_id: uuid.UUID) -> list[TaskEvent]:
        result = await self.session.execute(
            select(TaskEvent).where(TaskEvent.task_id == task_id).order_by(TaskEvent.created_at.asc())
        )
        return list(result.scalars().all())

    def add_event(self, task_id: uuid.UUID, action: str, detail: str | None, actor_id: uuid.UUID | None) -> None:
        self.session.add(TaskEvent(task_id=task_id, action=action, detail=detail, actor_id=actor_id))

    async def tasks_with_unmapped(self, jira_username: str) -> list[Task]:
        result = await self.session.execute(
            select(Task).where(func.lower(Task.unmapped_assignee) == jira_username.lower())
        )
        return list(result.scalars().all())

    async def attachments_for(self, task_ids: list[uuid.UUID]) -> list[TaskAttachment]:
        if not task_ids:
            return []
        result = await self.session.execute(
            select(TaskAttachment)
            .where(TaskAttachment.task_id.in_(task_ids))
            .order_by(TaskAttachment.created_at.asc())
        )
        return list(result.scalars().all())

    async def get_attachment(self, attachment_id: uuid.UUID) -> TaskAttachment | None:
        result = await self.session.execute(
            select(TaskAttachment).where(TaskAttachment.id == attachment_id)
        )
        return result.scalar_one_or_none()

    async def children_for(self, parent_ids: list[uuid.UUID]) -> list[Task]:
        if not parent_ids:
            return []
        result = await self.session.execute(
            select(Task)
            .where(Task.parent_task_id.in_(parent_ids))
            .order_by(Task.created_at.asc())
        )
        return list(result.scalars().all())

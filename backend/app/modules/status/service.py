import uuid
from datetime import datetime, timezone
from app.modules.status.model import UserStatus, StatusLog
from app.modules.status.repository import StatusRepository


class StatusService:
    def __init__(self, repo: StatusRepository):
        self.repo = repo

    async def get_my_status(self, user_id: uuid.UUID) -> UserStatus | None:
        return await self.repo.get(user_id)

    async def update_status(self, user_id: uuid.UUID, status: str) -> UserStatus:
        now = datetime.now(timezone.utc)
        updated = await self.repo.upsert(user_id, status, now)
        await self.repo.add_log(user_id, status, now)
        return updated

    async def get_all(self) -> list[UserStatus]:
        return await self.repo.get_all()

    async def get_log(self, user_id: uuid.UUID) -> list[StatusLog]:
        return await self.repo.get_log(user_id)

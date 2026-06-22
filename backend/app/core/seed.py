import logging
from app.core.database import async_session_maker
from app.core.security import hash_password
from app.core.config import settings
from app.modules.users.repository import UserRepository
from app.modules.users.model import User
from app.shared.roles import UserRole

logger = logging.getLogger(__name__)


async def seed_admin() -> None:
    async with async_session_maker() as session:
        repo = UserRepository(session)
        existing = await repo.get_by_username(settings.ADMIN_USERNAME)
        if existing:
            return
        admin = User(
            username=settings.ADMIN_USERNAME,
            password_hash=hash_password(settings.ADMIN_PASSWORD),
            full_name="System Admin",
            role=UserRole.ADMIN,
        )
        await repo.create(admin)
        logger.info("Admin user '%s' created", settings.ADMIN_USERNAME)

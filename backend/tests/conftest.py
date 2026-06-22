"""
Test configuration.

Strategy:
 - Schema is created ONCE per session via `alembic upgrade head` (sync fixture)
 - Each test gets a fresh async engine + DB truncation after it completes
 - All async fixtures are function-scoped (no loop-scope mixing)
"""
import os
import subprocess
import uuid as _uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlmodel import text

TEST_DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://rwms:rwms@localhost:5434/rwms",
)

# pre-import models so SQLModel metadata is populated (needed for truncate order)
from app.modules.users.model import User  # noqa: E402,F401
from app.modules.work.model import WorkSession  # noqa: E402,F401
from app.modules.status.model import StatusLog, UserStatus  # noqa: E402,F401
from app.modules.reports.model import DailyReport  # noqa: E402,F401
from app.modules.timeline.model import TimelineEvent  # noqa: E402,F401

TRUNCATE_SQL = text(
    "TRUNCATE timeline_events, daily_reports, status_logs, "
    "user_statuses, work_sessions, users RESTART IDENTITY CASCADE"
)


# ---------------------------------------------------------------------------
# Session-level schema setup (synchronous — no loop scope issues)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def db_schema():
    env = {**os.environ, "DATABASE_URL": TEST_DB_URL}
    # wipe and recreate schema for clean slate
    drop_result = subprocess.run(
        ["python", "-c",
         "import asyncio, asyncpg\n"
         "async def run():\n"
         f"    conn = await asyncpg.connect('{TEST_DB_URL.replace('postgresql+asyncpg', 'postgresql')}')\n"
         "    await conn.execute('DROP SCHEMA public CASCADE')\n"
         "    await conn.execute('CREATE SCHEMA public')\n"
         "    await conn.close()\n"
         "asyncio.run(run())"
        ],
        capture_output=True, text=True, env=env,
    )
    if drop_result.returncode != 0:
        pytest.fail(f"Schema reset failed:\n{drop_result.stderr}")

    migrate = subprocess.run(
        ["alembic", "upgrade", "head"],
        capture_output=True, text=True, env=env, cwd="/app",
    )
    if migrate.returncode != 0:
        pytest.fail(f"alembic upgrade head failed:\n{migrate.stderr}")


# ---------------------------------------------------------------------------
# Per-test async fixtures (function scope — no cross-loop issues)
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def engine():
    _engine = create_async_engine(TEST_DB_URL)
    yield _engine
    async with _engine.begin() as conn:
        await conn.execute(TRUNCATE_SQL)
    await _engine.dispose()


@pytest_asyncio.fixture
async def client(engine):
    from app.main import app
    from app.core.database import get_session

    async def _override():
        async with AsyncSession(engine, expire_on_commit=False) as s:
            yield s

    app.dependency_overrides[get_session] = _override
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_user_direct(engine, *, username, password, full_name, role):
    from app.core.security import hash_password
    from app.shared.roles import UserRole

    async with AsyncSession(engine) as s:
        user = User(
            username=username,
            password_hash=hash_password(password),
            full_name=full_name,
            role=UserRole(role),
        )
        s.add(user)
        await s.commit()
        await s.refresh(user)
        return user


async def _login(client, username: str, password: str) -> str:
    r = await client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Role fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def admin(engine):
    return await _create_user_direct(
        engine, username=f"admin_{_uuid.uuid4().hex[:6]}",
        password="pass123", full_name="Test Admin", role="ADMIN",
    )


@pytest_asyncio.fixture
async def manager(engine):
    return await _create_user_direct(
        engine, username=f"mgr_{_uuid.uuid4().hex[:6]}",
        password="pass123", full_name="Test Manager", role="MANAGER",
    )


@pytest_asyncio.fixture
async def supervisor(engine):
    return await _create_user_direct(
        engine, username=f"sup_{_uuid.uuid4().hex[:6]}",
        password="pass123", full_name="Test Supervisor", role="SUPERVISOR",
    )


@pytest_asyncio.fixture
async def member(engine):
    return await _create_user_direct(
        engine, username=f"mbr_{_uuid.uuid4().hex[:6]}",
        password="pass123", full_name="Test Member", role="MEMBER",
    )


@pytest_asyncio.fixture
async def admin_token(client, admin):
    return await _login(client, admin.username, "pass123")


@pytest_asyncio.fixture
async def manager_token(client, manager):
    return await _login(client, manager.username, "pass123")


@pytest_asyncio.fixture
async def supervisor_token(client, supervisor):
    return await _login(client, supervisor.username, "pass123")


@pytest_asyncio.fixture
async def member_token(client, member):
    return await _login(client, member.username, "pass123")

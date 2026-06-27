import asyncio
import logging
from datetime import datetime, timezone, timedelta
from math import floor
from zoneinfo import ZoneInfo

from sqlalchemy import select, and_
from app.core.database import async_session_maker
from app.modules.work.model import WorkSession
from app.modules.status.model import UserStatus
from app.modules.timeline.model import TimelineEvent
from app.core.events import broadcast

logger = logging.getLogger(__name__)
TEHRAN = ZoneInfo("Asia/Tehran")


async def close_stale_sessions() -> int:
    """Close all open sessions that belong to a previous day (Tehran date).

    Returns the number of sessions that were closed.
    """
    tehran_today = datetime.now(TEHRAN).date()

    async with async_session_maker() as db:
        result = await db.execute(
            select(WorkSession).where(
                and_(
                    WorkSession.ended_at.is_(None),
                    WorkSession.date < tehran_today,
                )
            )
        )
        stale = list(result.scalars().all())
        if not stale:
            return 0

        for ws in stale:
            # End at 23:59:59 of the session's date in Tehran time
            eod = datetime(
                ws.date.year, ws.date.month, ws.date.day,
                23, 59, 59, tzinfo=TEHRAN,
            )
            ws.ended_at = eod.astimezone(timezone.utc)
            ws.duration_minutes = floor(
                (ws.ended_at - ws.started_at).total_seconds() / 60
            )
            db.add(ws)

        await db.commit()

        now_utc = datetime.now(timezone.utc)
        for ws in stale:
            # Update user status → OFFLINE
            status_row = (
                await db.execute(
                    select(UserStatus).where(UserStatus.user_id == ws.user_id)
                )
            ).scalar_one_or_none()
            if status_row:
                status_row.status = "OFFLINE"
                status_row.updated_at = now_utc
                db.add(status_row)

            # Record timeline event
            db.add(
                TimelineEvent(
                    user_id=ws.user_id,
                    event_type="SESSION_AUTO_END",
                    payload={
                        "session_id": str(ws.id),
                        "duration_minutes": ws.duration_minutes,
                    },
                    occurred_at=ws.ended_at,
                )
            )

        await db.commit()

        for ws in stale:
            await broadcast({
                "type": "update",
                "user_id": str(ws.user_id),
                "status": "OFFLINE",
                "updated_at": now_utc.isoformat(),
            })

        logger.info("Auto-closed %d stale work session(s)", len(stale))
        return len(stale)


def _seconds_until_tehran_midnight() -> float:
    now = datetime.now(TEHRAN)
    tomorrow_midnight = (
        datetime(now.year, now.month, now.day, tzinfo=TEHRAN) + timedelta(days=1)
    )
    return (tomorrow_midnight - now).total_seconds()


async def midnight_scheduler() -> None:
    """Background task: every night at Tehran midnight, close any open sessions."""
    logger.info("Midnight scheduler started (timezone: Asia/Tehran)")
    while True:
        wait = _seconds_until_tehran_midnight()
        logger.info(
            "Next auto-close in %.0f s (%.1f h)", wait, wait / 3600
        )
        await asyncio.sleep(wait)
        try:
            await close_stale_sessions()
        except Exception:
            logger.exception("Midnight auto-close failed")

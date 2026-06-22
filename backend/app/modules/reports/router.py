import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.shared.dependencies import get_current_user
from app.shared.roles import MANAGEABLE_ROLES
from app.modules.reports.schema import ReportRead, ReportUpsert
from app.modules.reports.service import ReportService
from app.modules.reports.repository import ReportRepository
from app.modules.timeline.service import TimelineService
from app.modules.timeline.repository import TimelineRepository

router = APIRouter(prefix="/reports", tags=["reports"])


def _service(session: AsyncSession = Depends(get_session)) -> ReportService:
    return ReportService(ReportRepository(session))


def _timeline(session: AsyncSession = Depends(get_session)) -> TimelineService:
    return TimelineService(TimelineRepository(session))


@router.get("/today", response_model=ReportRead | None)
async def get_today(
    current_user: dict = Depends(get_current_user),
    service: ReportService = Depends(_service),
):
    return await service.get_today(uuid.UUID(current_user["sub"]))


@router.put("/today", response_model=ReportRead)
async def upsert_today(
    data: ReportUpsert,
    current_user: dict = Depends(get_current_user),
    service: ReportService = Depends(_service),
    timeline: TimelineService = Depends(_timeline),
):
    user_id = uuid.UUID(current_user["sub"])
    report = await service.upsert_today(user_id, data)
    await timeline.add_event(user_id, "REPORT_SUBMITTED", {"date": str(report.date)})
    return report


@router.get("/me", response_model=list[ReportRead])
async def list_my_reports(
    current_user: dict = Depends(get_current_user),
    service: ReportService = Depends(_service),
):
    return await service.list_by_user(uuid.UUID(current_user["sub"]))


@router.get("/{user_id}", response_model=list[ReportRead])
async def list_user_reports(
    user_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    service: ReportService = Depends(_service),
):
    if str(user_id) == current_user["sub"]:
        return await service.list_by_user(user_id)
    if not MANAGEABLE_ROLES.get(current_user["role"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return await service.list_by_user(user_id)


@router.get("/{user_id}/{date}", response_model=ReportRead | None)
async def get_user_report_by_date(
    user_id: uuid.UUID,
    date: str,
    current_user: dict = Depends(get_current_user),
    service: ReportService = Depends(_service),
):
    if str(user_id) != current_user["sub"] and not MANAGEABLE_ROLES.get(current_user["role"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return await service.get_by_date(user_id, date)

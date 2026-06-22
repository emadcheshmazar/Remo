from fastapi import APIRouter
from app.modules.auth.router import router as auth_router
from app.modules.users.router import router as users_router
from app.modules.work.router import router as work_router
from app.modules.status.router import router as status_router
from app.modules.reports.router import router as reports_router
from app.modules.timeline.router import router as timeline_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(users_router)
router.include_router(work_router)
router.include_router(status_router)
router.include_router(reports_router)
router.include_router(timeline_router)

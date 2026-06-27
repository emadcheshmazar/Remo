import asyncio
from contextlib import asynccontextmanager, suppress
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import router as api_router
from app.core.seed import seed_admin
from app.core.config import settings
from app.core.scheduler import close_stale_sessions, midnight_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    await seed_admin()
    # Close any sessions left open before this server restart
    await close_stale_sessions()
    # Start the nightly midnight auto-close task
    task = asyncio.create_task(midnight_scheduler())
    yield
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task


app = FastAPI(title="RWMS API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}

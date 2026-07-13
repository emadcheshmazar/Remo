import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.v1.router import router as api_router
from app.core.seed import seed_admin
from app.core.config import settings
from app.core.scheduler import close_stale_sessions, midnight_scheduler

logger = logging.getLogger(__name__)


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


app = FastAPI(title="RWMS API", version="1.1.1", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Collapse pydantic's list-of-errors payload into one readable message."""
    errors = exc.errors()
    message = "Invalid request"
    if errors:
        first = errors[0]
        message = first["msg"]
        if message.startswith("Value error, "):
            message = message[len("Value error, "):]
        # loc is like ("body", "username") — prefix the field name when there is one
        field = ".".join(str(p) for p in first["loc"] if p != "body")
        if field:
            message = f"{field}: {message}"
    return JSONResponse(status_code=422, content={"detail": message})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Never leak a raw traceback to the client — log it and return a clear message."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error. Please try again."})


@app.get("/health")
async def health():
    return {"status": "ok"}

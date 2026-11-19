"""Local disk storage for task attachments (voice/image/file)."""
import re
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings

_SAFE_NAME = re.compile(r"[^a-zA-Z0-9._-]+")
MAX_UPLOAD_BYTES = 25 * 1024 * 1024


def upload_root() -> Path:
    root = Path(settings.UPLOAD_DIR)
    root.mkdir(parents=True, exist_ok=True)
    return root


def classify_kind(content_type: str | None, filename: str) -> str:
    mime = (content_type or "").lower()
    lower = filename.lower()
    if mime.startswith("audio/") or lower.endswith((".webm", ".ogg", ".mp3", ".wav", ".m4a")):
        return "audio"
    if mime.startswith("image/") or lower.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp")):
        return "image"
    return "file"


def safe_filename(name: str) -> str:
    base = Path(name or "file").name
    cleaned = _SAFE_NAME.sub("_", base).strip("._") or "file"
    return cleaned[:180]


async def save_upload(task_id: uuid.UUID, upload: UploadFile) -> tuple[str, str, str, int]:
    raw = await upload.read()
    size = len(raw)
    if size < 1:
        raise ValueError("Empty file")
    if size > MAX_UPLOAD_BYTES:
        raise ValueError("File is too large (max 25MB)")
    original = safe_filename(upload.filename or "file")
    kind = classify_kind(upload.content_type, original)
    folder = upload_root() / "tasks" / str(task_id)
    folder.mkdir(parents=True, exist_ok=True)
    stored = f"{uuid.uuid4().hex}_{original}"
    path = folder / stored
    path.write_bytes(raw)
    relative = f"tasks/{task_id}/{stored}"
    return kind, original, relative, size


def absolute_path(relative: str) -> Path:
    return upload_root() / relative


def delete_upload(relative: str) -> None:
    path = absolute_path(relative)
    if path.is_file():
        path.unlink()

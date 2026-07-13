import re
import uuid
from datetime import datetime
from pydantic import BaseModel, field_validator
from app.shared.roles import UserRole

USERNAME_RE = re.compile(r"^[a-z0-9_.]+$")


def normalize_username(v: str) -> str:
    v = v.strip().lower()
    if not v:
        raise ValueError("Username cannot be empty")
    if any(ch.isspace() for ch in v):
        raise ValueError("Username cannot contain spaces")
    if not USERNAME_RE.match(v):
        raise ValueError("Username can only contain letters, numbers, underscores (_) and dots (.)")
    return v


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: UserRole

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        return normalize_username(v)


class UserRead(BaseModel):
    id: uuid.UUID
    username: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime
    supervisor_id: uuid.UUID | None = None

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    username: str | None = None
    full_name: str | None = None
    is_active: bool | None = None
    password: str | None = None
    role: UserRole | None = None

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return normalize_username(v)


class SupervisorAssign(BaseModel):
    supervisor_id: uuid.UUID | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str

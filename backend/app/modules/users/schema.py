import uuid
from datetime import datetime
from pydantic import BaseModel, field_validator
from app.shared.roles import UserRole


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: UserRole

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip().lower()
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username must be alphanumeric")
        return v


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
    full_name: str | None = None
    is_active: bool | None = None
    password: str | None = None


class SupervisorAssign(BaseModel):
    supervisor_id: uuid.UUID | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str

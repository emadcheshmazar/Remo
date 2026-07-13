import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.core.security import decode_token
from app.modules.users.repository import UserRepository

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

_INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session),
) -> dict:
    payload = decode_token(token)
    if payload is None or "sub" not in payload:
        raise _INVALID_CREDENTIALS

    # Re-check against the DB on every request rather than trusting the JWT's
    # claims for its whole lifetime — otherwise a deactivated, deleted, or
    # role-changed user keeps acting under their old identity until the
    # token naturally expires.
    user = await UserRepository(session).get_by_id(uuid.UUID(payload["sub"]))
    if user is None or not user.is_active:
        raise _INVALID_CREDENTIALS

    return {
        "sub": str(user.id),
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
    }


def require_roles(*roles: str):
    async def check(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user
    return check

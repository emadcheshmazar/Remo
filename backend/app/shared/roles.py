from enum import Enum


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    SUPERVISOR = "SUPERVISOR"
    MEMBER = "MEMBER"


MANAGEABLE_ROLES: dict[str, list[str]] = {
    UserRole.ADMIN: [UserRole.MANAGER],
    UserRole.MANAGER: [UserRole.SUPERVISOR, UserRole.MEMBER],
    UserRole.SUPERVISOR: [UserRole.MEMBER],
    UserRole.MEMBER: [],
}

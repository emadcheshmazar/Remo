Phase: 01 — Auth + Users Module
Status: completed

Summary
* Full auth + users implementation — login, JWT, role-based CRUD, admin seed

Actions Performed
* shared/roles.py: UserRole enum + MANAGEABLE_ROLES hierarchy
* users module: model, schema, repository, service, router (full CRUD)
* auth module: schema (LoginRequest/TokenResponse/MeResponse), router (login/me/change-password)
* core/seed.py: seeds ADMIN user on startup if not exists
* alembic/versions/001_create_users.py: first migration
* entrypoint.sh: runs alembic upgrade head then starts uvicorn
* frontend: login page (real form), dashboard page, providers, updated types/store

Architecture Impact
* Users table created with role hierarchy enforced at service layer
* JWT payload: sub, username, full_name, role
* Login returns token + user in one response (no second /me call needed)
* MANAGEABLE_ROLES enforced in UserService._assert_can_manage()

New Capabilities
* POST /api/v1/auth/login — returns token + user
* GET /api/v1/auth/me — returns current user from JWT
* PATCH /api/v1/auth/me/password — change own password
* GET/POST/GET/:id/PATCH/:id/DELETE/:id /api/v1/users — role-guarded CRUD

Constraints
* No self-registration — users created by authorized roles only
* Admin seeded from env ADMIN_USERNAME/ADMIN_PASSWORD (defaults: admin/admin123)
* Alembic runs on every container start (idempotent)

Next Step
* Phase 02: work sessions module (start/end session, one per user per day)
* Phase 03: status module (AVAILABLE/OFFLINE/BREAK/FOCUS/MEETING)

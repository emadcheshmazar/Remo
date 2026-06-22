🧠 SNAPSHOT — Phase 01

System State
* Auth + users fully implemented end-to-end
* Login → JWT → dashboard flow complete
* Admin auto-seeded on startup

Active Modules
* core: config (+ ADMIN creds), database, security, seed ✅
* shared: dependencies, roles ✅
* auth: schema, router ✅
* users: model, schema, repository, service, router ✅
* work: empty
* status: empty
* reports: empty
* timeline: empty

DB State
* Migration 001_create_users ready
* Table: users (id, username, password_hash, full_name, role, is_active, created_at, created_by)
* Alembic runs automatically via entrypoint.sh

Running Services
* db: postgres:16-alpine — port 5432
* backend: entrypoint.sh → alembic upgrade head → uvicorn --reload — port 8000
* frontend: next dev — port 3000

Known Constraints
* No WebSocket — polling every 30s via React Query
* MANAGEABLE_ROLES: ADMIN→[MANAGER], MANAGER→[SUPERVISOR,MEMBER], SUPERVISOR→[MEMBER]
* Login response includes user object (no second /me round-trip)
* Admin default: admin / admin123 (override via env)

Next Action
* Phase 02: work module — WorkSession model, start/end session, one active per user per day
* Phase 03: status module — UserStatus model, status change, status log

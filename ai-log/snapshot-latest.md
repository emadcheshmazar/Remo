🧠 SNAPSHOT — Phase 02

System State
* Work sessions fully implemented — start/end/summary/history
* Frontend has live timer on dashboard via WorkSessionCard

Active Modules
* core: config, database, security, seed ✅
* shared: dependencies, roles ✅
* auth: schema, router ✅
* users: model, schema, repository, service, router ✅
* work: model, schema, repository, service, router ✅
* status: empty
* reports: empty
* timeline: empty

DB State
* Migration 001: users table ✅
* Migration 002: work_sessions table ✅
* work_sessions: id, user_id(FK), date, started_at, ended_at, duration_minutes

Running Services
* db: postgres:16-alpine — port 5432
* backend: entrypoint.sh → alembic upgrade head → uvicorn --reload — port 8000
* frontend: next dev — port 3000

Known Constraints
* One active session at a time per user (409 if try to double-start)
* duration_minutes = floor((ended_at - started_at).total_seconds() / 60)
* No WebSocket — polling every 30s via React Query

Next Action
* Phase 03: status module
  - UserStatus model: user_id, status (enum), changed_at
  - StatusLog: history of changes
  - Endpoints: GET/PATCH /api/v1/status/me, GET /api/v1/status (all online users)
  - Frontend: status selector card on dashboard

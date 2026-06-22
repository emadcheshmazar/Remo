Phase: 03 — Status Module
Status: completed

Summary
* User status system with current state (upsert) + full history log

Actions Performed
* status/model.py: UserStatus (user_id PK, status, updated_at) + StatusLog (id, user_id, status, changed_at)
* status/repository.py: get, get_all, upsert, add_log, get_log
* status/service.py: get_my_status, update_status (upsert + log), get_all, get_log
* status/router.py: GET /status/me, PATCH /status/me, GET /status, GET /status/{user_id}/log
* 003_create_status_tables.py: Alembic migration for both tables
* frontend: StatusCard (5-state selector with color coding), status.service.ts, types updated
* dashboard updated: WorkSessionCard + StatusCard side by side

Architecture Impact
* UserStatus is upserted — one row per user, always up to date
* StatusLog is append-only — full history preserved
* update_status always writes both (atomic: upsert + log in same service call)

New Capabilities
* GET  /api/v1/status/me
* PATCH /api/v1/status/me
* GET  /api/v1/status (all users' current status)
* GET  /api/v1/status/{user_id}/log

Constraints
* Status changes server-timestamped only
* States: AVAILABLE / OFFLINE / BREAK / FOCUS / MEETING

Next Step
* Phase 04: daily reports module (text-only, 1 per user per day, editable until cutoff)
* Phase 05: timeline engine (derived from work sessions + status logs)

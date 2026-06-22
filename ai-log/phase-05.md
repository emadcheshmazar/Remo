Phase: 05 — Timeline Engine
Status: completed

Summary
* Auto-generated timeline — derived dataset from work/status/report events, zero user input

Actions Performed
* timeline/model.py: TimelineEvent (id, user_id, event_type, payload JSON, occurred_at)
* timeline/repository.py: add, list_by_user, list_by_user_today
* timeline/service.py: add_event, get_timeline, get_today
* timeline/router.py: GET /timeline/me, GET /timeline/me/today, GET /timeline/{user_id}
* 005_create_timeline_events.py: Alembic migration
* work/router.py: SESSION_START on start, SESSION_END on end (with duration)
* status/router.py: STATUS_CHANGE on update (payload: {to: status})
* reports/router.py: REPORT_SUBMITTED on upsert (payload: {date})
* frontend: TimelineCard (chronological list, color-coded), timeline.service.ts

Architecture Impact
* Timeline events written at router layer (composition pattern) — no cross-module service coupling
* TimelineEvent.payload is JSON — flexible per event_type
* Timeline is strictly append-only and read-only from user perspective

New Capabilities
* GET /api/v1/timeline/me
* GET /api/v1/timeline/me/today
* GET /api/v1/timeline/{user_id}
* Auto-appended on: SESSION_START, SESSION_END, STATUS_CHANGE, REPORT_SUBMITTED

Constraints
* Timeline is never edited or deleted — immutable log
* Managers/supervisors can view others' timelines

Next Step
* Phase 06: admin panel (frontend) — /admin route, manager creation UI
* Phase 07: manager/supervisor panel — team member management
* Phase 08: team presence view — see all members' status

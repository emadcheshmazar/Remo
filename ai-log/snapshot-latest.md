🧠 SNAPSHOT — Phase 04

System State
* 4 backend modules complete (auth, users, work, status, reports)
* Dashboard: WorkSessionCard + StatusCard + ReportCard

Active Modules
* auth ✅  users ✅  work ✅  status ✅  reports ✅
* timeline: empty

DB State
* 001: users ✅
* 002: work_sessions ✅
* 003: user_statuses + status_logs ✅
* 004: daily_reports (unique user_id+date) ✅

Known Constraints
* Reports editable only for current UTC day via PUT /today
* Unique constraint (user_id, date) enforced at DB level
* No WebSocket — polling 30s

Next Action
* Phase 05: timeline engine
  - TimelineEvent model: id, user_id, event_type, metadata (JSON), occurred_at
  - event_types: SESSION_START, SESSION_END, STATUS_CHANGE, REPORT_SUBMITTED
  - Auto-generated: triggered on work/status/report changes (service layer)
  - Endpoints: GET /api/v1/timeline/me, GET /api/v1/timeline/{user_id}
  - Frontend: timeline list component on dashboard

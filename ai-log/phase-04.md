Phase: 04 — Daily Reports Module
Status: completed

Summary
* Text-only daily reports (today/blockers/tomorrow), one per user per day, editable same day

Actions Performed
* reports/model.py: DailyReport (id, user_id, date, today_text, blockers_text, tomorrow_text, updated_at)
* reports/repository.py: get_by_date, list_by_user, create, update
* reports/service.py: get_today, upsert_today (server date), list_by_user, get_by_date
* reports/router.py: GET/PUT /reports/today, GET /reports/me, GET /reports/:uid, GET /reports/:uid/:date
* 004_create_daily_reports.py: migration with unique(user_id, date)
* frontend: ReportCard (3-field form, explicit save, last saved time), report.service.ts

Architecture Impact
* Upsert on (user_id, date) — DB unique constraint prevents duplicates
* Editable only for current UTC day (PUT /today always uses server date)
* Managers/supervisors can read others' reports; members can only read own

New Capabilities
* GET  /api/v1/reports/today
* PUT  /api/v1/reports/today
* GET  /api/v1/reports/me
* GET  /api/v1/reports/{user_id}
* GET  /api/v1/reports/{user_id}/{date}

Next Step
* Phase 05: timeline engine (derived from work sessions + status logs — no user input)

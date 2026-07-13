🧠 SNAPSHOT — Phase 12

System State
* All modules and pages complete
* Full end-to-end system: auth → dashboard → admin → team → presence
* App version: 1.1.1, shown globally as a tiny fixed badge in the bottom-left corner
* Versioning rule active: every future code/app change must bump the app version before completion
* Docker frontend host port changed from 3010 to 3210 because Windows reserves 3010 on this machine
* Team/admin user table has a visible username column and masked password edit field
* Team/admin user edit row can update username

Active Modules (Backend)
* auth ✅  users ✅  work ✅  status ✅  reports ✅  timeline ✅

Frontend Pages
* /login           → all
* /dashboard       → all (work session + status + report + timeline)
* /admin           → ADMIN (manager CRUD)
* /team            → MANAGER + SUPERVISOR (team CRUD)
* /presence        → ADMIN + MANAGER + SUPERVISOR (team presence board)

DB State (5 migrations)
* users, work_sessions, user_statuses, status_logs, daily_reports, timeline_events ✅

Deployment
* docker-compose up --build
* Admin default: admin / admin123 (env override: ADMIN_USERNAME, ADMIN_PASSWORD)
* Backend: localhost:8080
* Frontend: localhost:3210
* DB: localhost:5434

Versioning
* Frontend display source: frontend/package.json → frontend/src/config/version.ts → AppVersion badge
* Current app version: 1.1.1
* Future AI changes must update the version using SemVer:
  PATCH for fixes/copy/internal improvements, MINOR for new backward-compatible capabilities, MAJOR for breaking workflow/API/data changes
* Keep backend FastAPI metadata aligned when API behavior changes

System Complete
All planned phases delivered:
Phase 0: scaffold → Phase 1: auth/users → Phase 2: work → Phase 3: status
→ Phase 4: reports → Phase 5: timeline → Phase 6: admin → Phase 7: team → Phase 8: presence
Phase 9: global app version badge + future version bump rule
Phase 10: Docker frontend port fix for Windows reserved port range
Phase 11: team username column + masked password edit UX
Phase 12: editable username field in user edit row

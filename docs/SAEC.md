# 🧠 Remote Work System (RWMS) — Unified Architecture Contract (SAEC v2)

## 🎯 System Goal

Build a lightweight, production-ready remote work coordination system with:

- Role-based presence tracking
- Work session logging
- Status system
- Daily reports (text-only)
- Auto-generated timeline
- Minimal real-time sync
- Fully dockerized monorepo

No chat/calls module (excluded).

---

# 🧱 Architecture Overview

```
Frontend (Next.js)
  ↕ REST (primary)
  ↕ SSE or periodic polling (status/presence sync)
Backend (FastAPI Modular Monolith)
  ↕
PostgreSQL (persistent volume)
```

---

# 📦 Monorepo Structure (STRICT)

```
/project-root
├── frontend/
├── backend/
├── infra/
├── docker-compose.yml
└── ai-log/
```

---

# 🐳 Docker Rules

## Core Principles

- Full isolation per service
- Stateless backend/frontend
- Persistent database volume mandatory
- Rebuild-safe system

## DB Persistence Guarantee

```yaml
volumes:
  postgres_data:
```

Mapped to: `/var/lib/postgresql/data`

---

# ⚙️ Backend Stack (FastAPI)

## Core Tech

- FastAPI (async)
- SQLModel (ORM)
- Alembic (migrations)
- Pydantic v2
- asyncpg
- Uvicorn + Gunicorn

## Execution

```bash
gunicorn -k uvicorn.workers.UvicornWorker app.main:app
```

---

# 🧠 Backend Architecture (Clean Modular Monolith)

## Structure

```
backend/app/
├── core/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── work/
│   ├── status/
│   ├── reports/
│   ├── timeline/
├── api/
├── shared/
├── main.py
```

## Module Standard (MANDATORY)

Each module MUST contain:

```
model.py
schema.py
service.py
repository.py
router.py
```

## Layer Responsibilities

- **Router** → HTTP only
- **Service** → business logic only
- **Repository** → DB access only
- **Schema** → validation only

## SOLID Enforcement Rules

- No business logic in routers
- No DB access outside repositories
- Strict dependency direction
- Dependency injection via FastAPI `Depends`
- No cross-module coupling except `shared/` or `core/`

---

# 🗄️ Database Layer

- **DB**: PostgreSQL 16+
- **ORM**: SQLModel (preferred)
- **Migrations**: Alembic required

---

# 🔄 Sync System (Lightweight)

## Protocol

- **Option A:** SSE (`/events` endpoint) — server pushes status/presence changes
- **Option B:** Periodic HTTP polling — React Query refetch every 30s

No WebSocket. No socket.io. No persistent connections.

## What gets synced

- user status changes
- presence (online/offline)
- timeline updates

## Rule

REST is the only source of truth. Sync is read-only and fire-and-forget.

---

# ⏱ Work Tracking System

## Rules

- One active session per user per day
- Server timestamp only
- No client trust

---

# 🟢 Status System

## States

- `AVAILABLE`
- `OFFLINE`
- `BREAK`
- `FOCUS`
- `MEETING`

## Behavior

- Real-time sync via WS
- Status logs persisted
- Inactivity suggests state (not enforced)

---

# 📊 Timeline Engine (AUTO-GENERATED)

## Definition

Timeline is a **derived dataset**, NOT user input.

## Inputs

- work sessions
- status logs
- inactivity signals

## Output

```
timestamp → event_type → metadata
```

---

# 📝 Daily Reports

## Format (STRICT TEXT ONLY)

```
Today:
* ...

Blockers:
* ...

Tomorrow:
* ...
```

## Rules

- 1 report per user per day
- Editable until cutoff time
- Stored as TEXT

---

# ⚙️ Frontend (Next.js)

## Stack

- Next.js 15 (App Router)
- TypeScript
- TailwindCSS
- React Query (polling via refetchInterval)
- Zustand

---

# 🔌 API Design Rule

## REST
Primary and only system of truth.

## Sync
SSE or React Query polling — lightweight, stateless, no persistent connections.

---

# 🔐 Auth System

- JWT authentication
- bcrypt/argon2 hashing
- access + optional refresh token
- No registration, no OTP, no email — credentials set at creation only

---

# 👥 Role Hierarchy & User Management

## Roles (4 levels)

```
Admin → Manager → Supervisor → Member
```

## Who creates whom

| Role | Can create | Can edit/delete |
|------|-----------|-----------------|
| Admin | Manager | Manager |
| Manager | Supervisor, Member | Supervisor, Member |
| Supervisor | Member | Member |
| Member | — | — |

## Self-service

- Every user can change **only their own password**
- No other self-edit allowed

## Rules

- No self-registration
- No OTP, no email, no password reset flow
- User lifecycle: **create → edit → delete** — nothing else
- Username + password set at creation by the creator
- Admin panel is a separate section (`/admin`) — only accessible by Admin role
- Manager panel: create/edit/delete Supervisor + Member
- Supervisor panel: create/edit/delete Member

---

# 🚀 Engineering Constraints

- No Redis (unless scaling later)
- No queues
- No microservices
- No over-abstraction
- Prefer simplicity over extensibility until needed

---

# 🧠 System Philosophy

This is NOT:
- HR system
- surveillance tool
- enterprise workflow suite

It IS:
> lightweight presence + coordination system

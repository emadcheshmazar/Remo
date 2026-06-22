# 🧠 AI Code Execution Ruleset (ACER v2)

## 🎯 Purpose

This contract ensures AI generates production-ready code for RWMS system in a consistent, modular, and scalable way.

---

# 🧱 Core Requirement

AI MUST generate:

- full working code
- not pseudo-code
- not partial snippets
- fully docker-ready system

---

# 📦 Output Structure Requirement

AI output MUST follow:

```
frontend/
backend/
infra/
docker-compose.yml
```

---

# 🧠 Backend Code Rules (FastAPI)

## Mandatory Architecture

- modular monolith
- strict module boundaries
- service/repository pattern
- DTO separation
- dependency injection

## Module Standard

Each module:

```
model.py
schema.py
service.py
repository.py
router.py
```

## No Violation Rules

- NO DB logic in routers
- NO business logic in controllers
- NO global state
- NO cross-module direct imports

---

# ⚙️ Frontend Rules (Next.js)

- App Router only
- role-based routing
- API layer isolated in `/services`
- state separated (Zustand only for UI state)

---

# 🔄 Sync Rules

- NO WebSocket, NO socket.io
- REST is source of truth
- Sync via SSE or React Query polling (refetchInterval)
- No persistent connections

---

# 🐳 Docker Rules

- DB must persist
- backend stateless
- frontend stateless
- compose must rebuild safely

---

# 🧠 AI BEHAVIOR RULES

AI MUST:

- respect module boundaries
- never collapse architecture layers
- generate scalable structure
- avoid over-engineering
- prioritize simplicity

---

# 📌 EXECUTION MODE

When given a phase:

AI must:

1. read snapshot
2. understand module state
3. generate only missing parts
4. update logs mentally (not verbose)
5. proceed incrementally

---

# 🧩 Phase Execution Checklist

Before generating code for any phase:

- [ ] Snapshot loaded
- [ ] Active modules identified
- [ ] DB state known
- [ ] Only generate delta (missing parts)
- [ ] No re-generation of existing code

---

# 🚀 FINAL GOAL

Generate production-ready system:

- clean architecture
- scalable design
- minimal complexity
- fully dockerized
- AI-resumable development

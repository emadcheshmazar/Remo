# 🧠 AI Execution & Phase Memory Contract (AELC v2)

## 🎯 Purpose

This system reduces token usage by avoiding full project re-interpretation in every AI session.

Instead of reloading everything:
👉 AI uses incremental phase logs + snapshots.

---

# 📦 Core Concept

AI memory =

- Last Phase Log
- Latest Snapshot
- Next Step Instruction

NOT full codebase context.

---

# 🧾 Standard AI Phase Log Format

Each phase MUST produce:

```
Phase: <NAME>
Status: completed | in_progress | blocked
Summary
* ...

Actions Performed
* ...

Architecture Impact
* ...

New Capabilities
* ...

Constraints
* ...

Next Step
* ...

Context Compression
* max 5 bullets essential state only
```

---

# 🧠 SNAPSHOT CONTRACT (MANDATORY)

After each phase:

```
🧠 SNAPSHOT
System State
* ...

Active Modules
* ...

DB State
* ...

Running Services
* ...

Known Constraints
* ...

Next Action
* ...
```

---

# 🔁 CONTEXT LOADING RULE

When AI starts work:

1. Read last snapshot
2. Read last 1–2 logs
3. Do NOT reload full architecture
4. Continue execution

---

# ⚡ TOKEN OPTIMIZATION RULES

MUST:
- avoid repeating architecture
- avoid restating tech stack
- avoid re-explaining modules

MUST NOT:
- reconstruct system from scratch each time
- duplicate known decisions

---

# 📌 PHASE COMPLETION RULE

A phase is complete only if:

- Code implemented
- Docker works
- Log written
- Snapshot updated
- Next step defined

---

# 🚀 GOAL

Enable AI to:

- resume development instantly
- avoid context explosion
- maintain deterministic progression
- reduce onboarding cost per session

---

# 📁 Log Storage

All phase logs and snapshots stored in:

```
/ai-log/
├── phase-01.md
├── phase-02.md
├── ...
└── snapshot-latest.md
```

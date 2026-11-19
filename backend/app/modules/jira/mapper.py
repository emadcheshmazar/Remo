"""Pure Remo ↔ Jira Server/DC field mapping. No I/O."""
import hashlib
import json
import re
import uuid
from datetime import date, datetime, timezone
from typing import Any

DEFAULT_STATUS_MAP: dict[str, list[str]] = {
    "todo": ["To Do", "Open", "Backlog", "Todo"],
    "in_progress": ["In Progress"],
    "done": ["Done", "Resolved", "Closed"],
    "cancelled": ["Cancelled", "Canceled"],
}

PRIORITY_TO_JIRA = {
    "highest": "Highest",
    "high": "High",
    "medium": "Medium",
    "low": "Low",
    "lowest": "Lowest",
}
JIRA_TO_PRIORITY = {v.lower(): k for k, v in PRIORITY_TO_JIRA.items()}

REMO_TASK_RE = re.compile(r"remo-task:([0-9a-fA-F-]{36})")
_ESTIMATE_RE = re.compile(r"(\d+)\s*([wdhm])", re.IGNORECASE)
# Jira's default time-tracking calendar: 8h day, 5d week.
_UNIT_MINUTES = {"w": 5 * 8 * 60, "d": 8 * 60, "h": 60, "m": 1}

ISSUE_FIELDS = [
    "summary",
    "description",
    "duedate",
    "priority",
    "labels",
    "assignee",
    "reporter",
    "status",
    "timetracking",
    "updated",
    "created",
    "project",
]


def remo_id_label(task_id: uuid.UUID) -> str:
    return f"remo-{task_id.hex[:12]}"


def is_remo_marker(label: str) -> bool:
    name = (label or "").lower()
    return name == "remo" or name.startswith("remo-")


def remo_task_type_from_labels(labels: list[str] | None) -> str:
    names = {(label or "").lower() for label in (labels or [])}
    if "remo-urgent" in names or "urgent" in names or "hot" in names:
        return "urgent"
    return "sprint"


def jira_label(name: str) -> str:
    text = (name or "").strip().lower().replace(" ", "-")
    text = re.sub(r"[^a-z0-9_-]", "", text)
    return text[:50]


def coerce_description(description: Any) -> str:
    """Server/DC returns wiki markup string; tolerate odd shapes defensively."""
    if description is None:
        return ""
    if isinstance(description, str):
        return description
    if isinstance(description, dict):
        # Rare ADF-like payload — keep readable text if present
        text = description.get("text") or description.get("content")
        if isinstance(text, str):
            return text
        return json.dumps(description, ensure_ascii=False)
    return str(description)


_REPRO_START = "--- remo-reproduction ---"
_REPRO_END = "--- /remo-reproduction ---"
_SCREEN_PREFIX = "remo-screenshot:"


def strip_markers(description: str | None) -> str:
    text = coerce_description(description)
    if not text:
        return ""
    kept = []
    skipping_repro = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped == _REPRO_START:
            skipping_repro = True
            continue
        if stripped == _REPRO_END:
            skipping_repro = False
            continue
        if skipping_repro:
            continue
        if stripped.startswith("remo-task:") or stripped.startswith("remo-assignees:"):
            continue
        if stripped.startswith(_SCREEN_PREFIX):
            continue
        kept.append(line)
    return "\n".join(kept).strip()


def extract_reproduction(description: str | None) -> str | None:
    text = coerce_description(description)
    if not text or _REPRO_START not in text:
        return None
    capturing = False
    lines: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped == _REPRO_START:
            capturing = True
            continue
        if stripped == _REPRO_END:
            break
        if capturing:
            lines.append(line)
    value = "\n".join(lines).strip()
    return value or None


def extract_screenshot_url(description: str | None) -> str | None:
    text = coerce_description(description)
    if not text:
        return None
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith(_SCREEN_PREFIX):
            value = stripped[len(_SCREEN_PREFIX) :].strip()
            return value or None
    return None


def extract_task_id(description: str | None) -> uuid.UUID | None:
    text = coerce_description(description)
    if not text:
        return None
    match = REMO_TASK_RE.search(text)
    if not match:
        return None
    try:
        return uuid.UUID(match.group(1))
    except ValueError:
        return None


def with_markers(
    description: str | None,
    task_id: uuid.UUID,
    extra_usernames: list[str],
    *,
    reproduction_steps: str | None = None,
    screenshot_url: str | None = None,
) -> str:
    base = strip_markers(description)
    lines = [base] if base else []
    repro = (reproduction_steps or "").strip()
    if repro:
        lines.append(_REPRO_START)
        lines.append(repro)
        lines.append(_REPRO_END)
    screen = (screenshot_url or "").strip()
    if screen:
        lines.append(f"{_SCREEN_PREFIX} {screen}")
    lines.append(f"remo-task:{task_id}")
    if extra_usernames:
        lines.append("remo-assignees: " + ", ".join(extra_usernames))
    return "\n\n".join(line for line in lines if line)


def minutes_to_jira(minutes: int | None) -> str | None:
    if not minutes or minutes < 1:
        return None
    hours, mins = divmod(int(minutes), 60)
    if hours and mins:
        return f"{hours}h {mins}m"
    if hours:
        return f"{hours}h"
    return f"{mins}m"


def jira_estimate_to_minutes(text: str | None, seconds: int | None = None) -> int | None:
    if seconds:
        minutes = int(seconds) // 60
        return minutes or None
    if not text:
        return None
    total = 0
    found = False
    for amount, unit in _ESTIMATE_RE.findall(text):
        found = True
        total += int(amount) * _UNIT_MINUTES[unit.lower()]
    return total or None if found else None


def priority_to_jira(priority: str | None) -> str:
    return PRIORITY_TO_JIRA.get((priority or "medium").lower(), "Medium")


def jira_priority_to_remo(name: str | None) -> str:
    if not name:
        return "medium"
    return JIRA_TO_PRIORITY.get(name.strip().lower(), "medium")


def normalize_status_map(raw: dict | None) -> dict[str, list[str]]:
    source = raw or DEFAULT_STATUS_MAP
    cleaned: dict[str, list[str]] = {}
    for key in ("todo", "in_progress", "done", "cancelled"):
        names = source.get(key) or DEFAULT_STATUS_MAP[key]
        if isinstance(names, str):
            names = [part.strip() for part in names.split(",") if part.strip()]
        cleaned[key] = [str(n).strip() for n in names if str(n).strip()] or list(DEFAULT_STATUS_MAP[key])
    return cleaned


def remo_status_from_jira(name: str | None, status_map: dict | None) -> str:
    mapping = normalize_status_map(status_map)
    folded = (name or "").strip().lower()
    if not folded:
        return "in_progress"
    for remo, names in mapping.items():
        if any(n.lower() == folded for n in names):
            return remo
    if "progress" in folded:
        return "in_progress"
    if folded in {"done", "resolved", "closed"} or "done" in folded:
        return "done"
    if "cancel" in folded:
        return "cancelled"
    return "in_progress"


def pick_transition(transitions: list[dict], target_status: str, status_map: dict | None) -> str | None:
    mapping = normalize_status_map(status_map)
    wanted = {n.lower() for n in mapping.get(target_status, [])}
    for item in transitions:
        to_name = ((item.get("to") or {}).get("name") or "").lower()
        if to_name in wanted:
            return str(item["id"])
    for item in transitions:
        to_name = ((item.get("to") or {}).get("name") or "").lower()
        if target_status == "in_progress" and "progress" in to_name:
            return str(item["id"])
        if target_status == "done" and to_name in {"done", "resolved", "closed"}:
            return str(item["id"])
        if target_status == "todo" and to_name in {"to do", "open", "todo", "backlog", "reopened"}:
            return str(item["id"])
        if target_status == "cancelled" and "cancel" in to_name:
            return str(item["id"])
    return None


def pick_transition_to_column(transitions: list[dict], column: dict) -> str | None:
    status_ids = {str(item).lower() for item in column.get("status_ids") or []}
    status_names = {str(item).strip().lower() for item in column.get("status_names") or [] if str(item).strip()}
    for item in transitions:
        to = item.get("to") or {}
        to_id = str(to.get("id") or "").lower()
        to_name = str(to.get("name") or "").strip().lower()
        if (to_id and to_id in status_ids) or (to_name and to_name in status_names):
            return str(item["id"])
    return None


def parse_jira_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    text = value.strip().replace("Z", "+00:00")
    if len(text) >= 5 and text[-5] in "+-" and text[-3] != ":":
        text = text[:-2] + ":" + text[-2:]
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def parse_due(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def task_fingerprint(
    *,
    title: str | None,
    description: str | None,
    due: date | None,
    priority: str | None,
    status: str | None,
    estimate_minutes: int | None,
    assignee_username: str | None,
    labels: list[str],
) -> str:
    body = {
        "title": (title or "").strip(),
        "description": strip_markers(description),
        "due": due.isoformat() if due else "",
        "priority": (priority or "medium").lower(),
        "status": status or "todo",
        "estimate": int(estimate_minutes or 0),
        "assignee": (assignee_username or "").strip().lower(),
        "labels": sorted({jira_label(label) for label in labels if label and not is_remo_marker(label)}),
    }
    raw = json.dumps(body, sort_keys=True, ensure_ascii=False).encode()
    return hashlib.sha256(raw).hexdigest()


def issue_url(base_url: str, key: str) -> str:
    return f"{base_url.rstrip('/')}/browse/{key}"

import io
import uuid

from tests.conftest import _auth


async def _create_and_login(client, creator_token, *, role, password="pass123"):
    username = f"{role.lower()}_{uuid.uuid4().hex[:6]}"
    response = await client.post(
        "/api/v1/users",
        json={"username": username, "password": password, "full_name": role.title(), "role": role},
        headers=_auth(creator_token),
    )
    assert response.status_code == 201, response.text
    user_id = response.json()["id"]
    login = await client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert login.status_code == 200, login.text
    return user_id, login.json()["access_token"], username


def _task_body(**overrides):
    body = {
        "title": "Write the spec",
        "estimate_minutes": 90,
        "due_date": "2026-11-30",
    }
    body.update(overrides)
    return body


def _created(response):
    payload = response.json()
    assert "tasks" in payload, payload
    assert payload["tasks"], payload
    return payload["tasks"]


async def test_member_creates_own_task_and_cannot_assign_others(client, manager_token):
    _, sup_token, _ = await _create_and_login(client, manager_token, role="SUPERVISOR")
    member_id, member_token, _ = await _create_and_login(client, sup_token, role="MEMBER")
    other_id, _, _ = await _create_and_login(client, sup_token, role="MEMBER")

    missing = await client.post("/api/v1/tasks", json={"title": "No estimate", "due_date": "2026-11-30"}, headers=_auth(member_token))
    assert missing.status_code == 422

    empty = await client.post("/api/v1/tasks", json=_task_body(title="  "), headers=_auth(member_token))
    assert empty.status_code == 422

    created = await client.post("/api/v1/tasks", json=_task_body(), headers=_auth(member_token))
    assert created.status_code == 201, created.text
    payload = _created(created)[0]
    assert payload["title"] == "Write the spec"
    assert payload["estimate_minutes"] == 90
    assert payload["due_date"] == "2026-11-30"
    assert payload["task_type"] == "sprint"
    assert payload["needs_assignment"] is False
    assert payload["assignees"][0]["id"] == member_id
    assert payload["jira_sync_status"] == "not_configured"
    assert payload["key"].startswith("RW-")

    denied = await client.post(
        "/api/v1/tasks",
        json=_task_body(assignee_ids=[other_id]),
        headers=_auth(member_token),
    )
    assert denied.status_code == 403


async def test_supervisor_scope_and_manager_visibility(client, manager_token, admin_token):
    _, sup_token, _ = await _create_and_login(client, manager_token, role="SUPERVISOR")
    _, other_sup_token, _ = await _create_and_login(client, manager_token, role="SUPERVISOR")
    member_id, member_token, _ = await _create_and_login(client, sup_token, role="MEMBER")
    _, other_member_token, _ = await _create_and_login(client, other_sup_token, role="MEMBER")

    created = await client.post(
        "/api/v1/tasks",
        json=_task_body(assignee_ids=[member_id], priority="high"),
        headers=_auth(sup_token),
    )
    assert created.status_code == 201, created.text
    task_id = _created(created)[0]["id"]

    visible = await client.get("/api/v1/tasks", headers=_auth(member_token))
    assert task_id in {row["id"] for row in visible.json()}

    hidden = await client.get("/api/v1/tasks", headers=_auth(other_member_token))
    assert task_id not in {row["id"] for row in hidden.json()}

    other_team = await client.get("/api/v1/tasks", headers=_auth(other_sup_token))
    assert task_id not in {row["id"] for row in other_team.json()}

    org = await client.get("/api/v1/tasks", headers=_auth(manager_token))
    assert task_id in {row["id"] for row in org.json()}

    denied = await client.post(
        "/api/v1/tasks",
        json=_task_body(assignee_ids=[member_id]),
        headers=_auth(other_sup_token),
    )
    assert denied.status_code == 403

    admin = await client.get("/api/v1/tasks", headers=_auth(admin_token))
    assert admin.status_code == 403

    moved = await client.post(
        f"/api/v1/tasks/{task_id}/transition",
        json={"status": "in_progress"},
        headers=_auth(member_token),
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["status"] == "in_progress"

    retry = await client.post(f"/api/v1/tasks/{task_id}/sync/retry", headers=_auth(member_token))
    assert retry.status_code == 403
    retry_ok = await client.post(f"/api/v1/tasks/{task_id}/sync/retry", headers=_auth(sup_token))
    assert retry_ok.status_code == 200

    removed = await client.delete(f"/api/v1/tasks/{task_id}", headers=_auth(member_token))
    assert removed.status_code == 403
    removed_ok = await client.delete(f"/api/v1/tasks/{task_id}", headers=_auth(sup_token))
    assert removed_ok.status_code == 200
    assert removed_ok.json()["status"] == "cancelled"


async def test_due_filters_and_labels(client, manager_token):
    _, sup_token, _ = await _create_and_login(client, manager_token, role="SUPERVISOR")
    member_id, member_token, _ = await _create_and_login(client, sup_token, role="MEMBER")

    denied = await client.post("/api/v1/task-labels", json={"title": "remote", "color": "#10b981"}, headers=_auth(member_token))
    assert denied.status_code == 403
    label = await client.post("/api/v1/task-labels", json={"title": "remote", "color": "#10b981"}, headers=_auth(sup_token))
    assert label.status_code == 201, label.text

    overdue = await client.post(
        "/api/v1/tasks",
        json=_task_body(due_date="2020-01-01", assignee_ids=[member_id], label_ids=[label.json()["id"]]),
        headers=_auth(sup_token),
    )
    assert overdue.status_code == 201, overdue.text
    task_id = _created(overdue)[0]["id"]
    listed = await client.get("/api/v1/tasks", params={"due": "overdue"}, headers=_auth(member_token))
    assert task_id in {row["id"] for row in listed.json()}
    by_label = await client.get("/api/v1/tasks", params={"label_id": label.json()["id"]}, headers=_auth(manager_token))
    assert task_id in {row["id"] for row in by_label.json()}


async def test_task_type_inbox_multi_assignee_and_attachments(client, manager_token):
    _, sup_token, _ = await _create_and_login(client, manager_token, role="SUPERVISOR")
    m1, m1_token, _ = await _create_and_login(client, sup_token, role="MEMBER")
    m2, _, _ = await _create_and_login(client, sup_token, role="MEMBER")

    inbox = await client.post(
        "/api/v1/tasks",
        json=_task_body(title="Needs owner", task_type="urgent", assignee_ids=[]),
        headers=_auth(sup_token),
    )
    assert inbox.status_code == 201, inbox.text
    inbox_task = _created(inbox)[0]
    assert inbox_task["needs_assignment"] is True
    assert inbox_task["task_type"] == "urgent"
    assert inbox_task["assignees"] == []

    listed = await client.get("/api/v1/tasks", params={"scope": "inbox"}, headers=_auth(sup_token))
    assert inbox_task["id"] in {row["id"] for row in listed.json()}
    member_inbox = await client.get("/api/v1/tasks", params={"scope": "inbox"}, headers=_auth(m1_token))
    assert member_inbox.status_code == 403

    assigned = await client.patch(
        f"/api/v1/tasks/{inbox_task['id']}",
        json={"assignee_ids": [m1]},
        headers=_auth(sup_token),
    )
    assert assigned.status_code == 200, assigned.text
    assert assigned.json()["needs_assignment"] is False
    assert assigned.json()["assignees"][0]["id"] == m1
    assert any(event["action"] == "updated" for event in assigned.json()["events"])

    multi = await client.post(
        "/api/v1/tasks",
        json=_task_body(title="Split work", assignee_ids=[m1, m2], task_type="sprint"),
        headers=_auth(sup_token),
    )
    assert multi.status_code == 201, multi.text
    tasks = _created(multi)
    assert len(tasks) == 2
    owners = {tasks[0]["assignees"][0]["id"], tasks[1]["assignees"][0]["id"]}
    assert owners == {m1, m2}

    upload = await client.post(
        f"/api/v1/tasks/{tasks[0]['id']}/attachments",
        headers=_auth(sup_token),
        files={"file": ("note.txt", io.BytesIO(b"hello remo"), "text/plain")},
    )
    assert upload.status_code == 201, upload.text
    att = upload.json()
    assert att["kind"] == "file"
    assert att["filename"] == "note.txt"

    detail = await client.get(f"/api/v1/tasks/{tasks[0]['id']}", headers=_auth(sup_token))
    assert detail.status_code == 200
    assert len(detail.json()["attachments"]) == 1
    assert any(event["action"] == "attachment_added" for event in detail.json()["events"])

    downloaded = await client.get(att["url"], headers=_auth(sup_token))
    assert downloaded.status_code == 200
    assert downloaded.content == b"hello remo"

    removed = await client.delete(f"/api/v1/tasks/attachments/{att['id']}", headers=_auth(sup_token))
    assert removed.status_code == 204


async def test_approval_pipeline_and_subtasks(client, manager_token):
    _, sup_token, _ = await _create_and_login(client, manager_token, role="SUPERVISOR")
    member_id, member_token, _ = await _create_and_login(client, sup_token, role="MEMBER")

    created = await client.post(
        "/api/v1/tasks",
        json=_task_body(title="Needs approve", assignee_ids=[member_id]),
        headers=_auth(sup_token),
    )
    assert created.status_code == 201, created.text
    task = _created(created)[0]
    assert task["pipeline"] == "backlog"
    assert task["approval_status"] == "pending"
    assert task["can_approve"] is True

    denied = await client.post(f"/api/v1/tasks/{task['id']}/approve", json={"approve": True}, headers=_auth(member_token))
    assert denied.status_code == 403

    approved = await client.post(f"/api/v1/tasks/{task['id']}/approve", json={"approve": True}, headers=_auth(sup_token))
    assert approved.status_code == 200, approved.text
    assert approved.json()["pipeline"] == "approved"
    assert approved.json()["approval_status"] == "approved"
    assert any(event["action"] == "approved" for event in approved.json()["events"])

    backlog = await client.get("/api/v1/tasks", params={"pipeline": "backlog"}, headers=_auth(sup_token))
    assert task["id"] not in {row["id"] for row in backlog.json()}
    ready = await client.get("/api/v1/tasks", params={"pipeline": "approved"}, headers=_auth(sup_token))
    assert task["id"] in {row["id"] for row in ready.json()}

    child = await client.post(
        "/api/v1/tasks",
        json=_task_body(title="Child work", assignee_ids=[member_id], parent_task_id=task["id"], auto_approve=True),
        headers=_auth(sup_token),
    )
    assert child.status_code == 201, child.text
    child_task = _created(child)[0]
    assert child_task["parent_task_id"] == task["id"]
    assert child_task["pipeline"] == "approved"

    parent = await client.get(f"/api/v1/tasks/{task['id']}", headers=_auth(sup_token))
    assert any(row["id"] == child_task["id"] for row in parent.json()["children"])

    roots = await client.get("/api/v1/tasks", params={"roots_only": True}, headers=_auth(sup_token))
    root_ids = {row["id"] for row in roots.json()}
    assert task["id"] in root_ids
    assert child_task["id"] not in root_ids


async def test_urgent_hot_bug_fields_and_recurrence(client, manager_token):
    _, sup_token, _ = await _create_and_login(client, manager_token, role="SUPERVISOR")
    member_id, member_token, _ = await _create_and_login(client, sup_token, role="MEMBER")

    # Sprint still requires estimate.
    missing = await client.post(
        "/api/v1/tasks",
        json={"title": "Sprint needs estimate", "due_date": "2026-11-30", "task_type": "sprint"},
        headers=_auth(sup_token),
    )
    assert missing.status_code == 422

    urgent = await client.post(
        "/api/v1/tasks",
        json={
            "title": "Hot bug",
            "task_type": "urgent",
            "assignee_ids": [member_id],
            "reproduction_steps": "1. Open app\n2. Crash",
            "screenshot_url": "https://example.com/shot.png",
            "recurrence": "daily",
        },
        headers=_auth(sup_token),
    )
    assert urgent.status_code == 201, urgent.text
    task = _created(urgent)[0]
    assert task["task_type"] == "urgent"
    assert task["priority"] == "high"
    assert task["estimate_minutes"] is None
    assert task["due_date"] is not None
    assert task["reproduction_steps"].startswith("1. Open")
    assert task["screenshot_url"] == "https://example.com/shot.png"
    assert task["recurrence"] == "daily"

    hot = await client.get("/api/v1/tasks", params={"due": "hot"}, headers=_auth(member_token))
    assert hot.status_code == 200
    assert task["id"] in {row["id"] for row in hot.json()}

    overdue = await client.post(
        "/api/v1/tasks",
        json=_task_body(title="Late sprint", due_date="2020-01-01", assignee_ids=[member_id], task_type="sprint"),
        headers=_auth(sup_token),
    )
    overdue_id = _created(overdue)[0]["id"]
    hot2 = await client.get("/api/v1/tasks", params={"due": "hot"}, headers=_auth(sup_token))
    hot_ids = {row["id"] for row in hot2.json()}
    assert task["id"] in hot_ids
    assert overdue_id in hot_ids

    done = await client.post(
        f"/api/v1/tasks/{task['id']}/transition",
        json={"status": "done"},
        headers=_auth(member_token),
    )
    assert done.status_code == 200, done.text
    assert any(event["action"] == "recurrence_spawned" for event in done.json()["events"])

    listing = await client.get("/api/v1/tasks", headers=_auth(member_token))
    children = [
        row
        for row in listing.json()
        if row["title"] == "Hot bug" and row["id"] != task["id"] and row["status"] == "todo"
    ]
    assert len(children) == 1
    assert children[0]["recurrence"] == "daily"
    assert children[0]["reproduction_steps"].startswith("1. Open")

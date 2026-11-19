import json
import uuid

import httpx

from app.modules.jira.client import JiraClient
from app.modules.jira.mapper import (
    extract_reproduction,
    extract_screenshot_url,
    jira_estimate_to_minutes,
    minutes_to_jira,
    pick_transition,
    remo_status_from_jira,
    strip_markers,
    with_markers,
)
from app.shared.dates import ets_period_bounds, ets_period_of, from_jalali, jalali_to_date, to_jalali
from tests.conftest import _auth
from tests.test_tasks import _create_and_login, _task_body


def test_jalali_and_ets_period():
    assert to_jalali(2024, 3, 20) == (1403, 1, 1)
    assert from_jalali(1403, 1, 1) == (2024, 3, 20)
    assert ets_period_of(1403, 1, 10) == (1403, 1)
    assert ets_period_of(1403, 1, 24) == (1403, 2)
    start, end = ets_period_bounds(1403, 1)
    assert start == jalali_to_date(1402, 12, 24)
    assert end == jalali_to_date(1403, 1, 23)


def test_jira_field_mapping():
    assert minutes_to_jira(150) == "2h 30m"
    assert jira_estimate_to_minutes("2h 30m") == 150
    assert jira_estimate_to_minutes(None, 9000) == 150
    assert remo_status_from_jira("In Progress", None) == "in_progress"
    assert remo_status_from_jira("Done", None) == "done"
    chosen = pick_transition(
        [{"id": "31", "to": {"name": "In Progress"}}, {"id": "41", "to": {"name": "Done"}}],
        "in_progress",
        None,
    )
    assert chosen == "31"
    tid = uuid.uuid4()
    marked = with_markers(
        "body",
        tid,
        [],
        reproduction_steps="click boom",
        screenshot_url="https://example.com/a.png",
    )
    assert "click boom" in marked
    assert extract_reproduction(marked) == "click boom"
    assert extract_screenshot_url(marked) == "https://example.com/a.png"
    assert strip_markers(marked) == "body"
    assert f"remo-task:{tid}" in marked


async def test_jira_client_uses_bearer_and_v2():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.method, str(request.url), request.headers["Authorization"]))
        if request.url.path == "/rest/api/2/myself":
            return httpx.Response(200, json={"name": "svc", "displayName": "Service"})
        if request.url.path == "/rest/api/2/issue/ABC-1":
            assert "summary" in (request.url.params.get("fields") or "")
            return httpx.Response(200, json={"id": "1", "key": "ABC-1", "fields": {"summary": "Hi"}})
        if request.url.path == "/rest/api/2/search":
            body = json.loads(request.content.decode())
            assert body["jql"].startswith("project")
            assert "summary" in body["fields"]
            return httpx.Response(200, json={"issues": [], "total": 0, "startAt": 0, "maxResults": 50})
        return httpx.Response(404, json={"errorMessages": ["nope"]})

    transport = httpx.MockTransport(handler)
    async with JiraClient("https://jira.example", "bearer", "pat-token", transport=transport) as client:
        me = await client.myself()
        await client.get_issue("ABC-1")
        await client.search('project = "ABC" AND resolution = Unresolved')
    assert me["name"] == "svc"
    assert seen[0][0] == "GET"
    assert "/rest/api/2/myself" in seen[0][1]
    assert seen[0][2] == "Bearer pat-token"


class _Resp:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload
        self.content = b"" if payload is None else json.dumps(payload).encode()
        self.text = self.content.decode()

    def json(self):
        return self._payload


class _FakeJira:
    def __init__(self, *args, **kwargs):
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return None

    async def aclose(self):
        return None

    async def request(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs.get("json")))
        _FakeJira.calls.append((method, url, kwargs.get("json")))
        if url.endswith("/search"):
            return _Resp(200, {"issues": [], "total": 0, "startAt": 0, "maxResults": 50})
        if method == "POST" and url.endswith("/issue"):
            return _Resp(201, {"id": "10001", "key": "RWMS-7", "self": "https://jira.example/rest/api/2/issue/10001"})
        if method == "PUT" and "/issue/" in url:
            return _Resp(204, None)
        if url.endswith("/transitions"):
            return _Resp(200, {"transitions": [{"id": "21", "to": {"name": "In Progress"}}]})
        if url.endswith("/remotelink") or url.endswith("/watchers"):
            return _Resp(201, {"id": 1})
        if method == "GET" and "/issue/" in url and "createmeta" not in url and not url.rstrip("/").endswith("/transitions"):
            return _Resp(200, {
                "id": "10001",
                "key": "RWMS-7",
                "fields": {
                    "summary": "Synced",
                    "updated": "2026-11-19T12:00:00.000+0000",
                    "status": {"name": "To Do"},
                    "labels": ["remo"],
                    "timetracking": {"originalEstimate": "2h", "originalEstimateSeconds": 7200},
                },
            })
        return _Resp(404, {"errorMessages": [f"unhandled {method} {url}"]})


_FakeJira.calls = []


def _connection_body():
    return {
        "base_url": "https://jira.example",
        "auth_type": "bearer",
        "secret": "pat-token",
        "default_project_key": "RWMS",
        "default_issuetype_name": "Task",
    }


async def test_push_create_and_update(client, manager_token, monkeypatch):
    monkeypatch.setenv("JIRA_SYNC_INLINE", "1")
    _FakeJira.calls = []
    monkeypatch.setattr("app.modules.jira.client.httpx.AsyncClient", _FakeJira)

    _, sup_token, _ = await _create_and_login(client, manager_token, role="SUPERVISOR")
    member_id, _, username = await _create_and_login(client, sup_token, role="MEMBER")
    saved = await client.put("/api/v1/jira/connection", json=_connection_body(), headers=_auth(manager_token))
    assert saved.status_code == 200, saved.text
    assert saved.json()["has_secret"] is True
    assert "secret" not in saved.json()

    created = await client.post(
        "/api/v1/tasks",
        json=_task_body(assignee_ids=[member_id], priority="high", estimate_minutes=150),
        headers=_auth(sup_token),
    )
    assert created.status_code == 201, created.text
    body = created.json()["tasks"][0]
    assert body["jira_issue_key"] == "RWMS-7"
    assert body["jira_sync_status"] == "synced"
    assert body["jira_url"].endswith("/browse/RWMS-7")

    post = next(call for call in _FakeJira.calls if call[0] == "POST" and call[1].endswith("/issue"))
    fields = post[2]["fields"]
    assert fields["summary"] == "Write the spec"
    assert fields["project"]["key"] == "RWMS"
    assert fields["assignee"]["name"] == username
    assert fields["priority"]["name"] == "High"
    assert fields["timetracking"]["originalEstimate"] == "2h 30m"
    assert fields["duedate"] == "2026-11-30"
    assert "remo-sprint" in fields["labels"]
    assert f"remo-task:{body['id']}" in fields["description"]

    retried = await client.post(f"/api/v1/tasks/{body['id']}/sync/retry", headers=_auth(manager_token))
    assert retried.status_code == 200, retried.text
    assert any(call[0] == "PUT" and "/issue/RWMS-7" in call[1] for call in _FakeJira.calls)


class _StrictThenMinimal(_FakeJira):
    create_attempts = 0

    async def request(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs.get("json")))
        _FakeJira.calls.append((method, url, kwargs.get("json")))
        if url.endswith("/search"):
            return _Resp(200, {"issues": [], "total": 0, "startAt": 0, "maxResults": 50})
        if method == "POST" and url.endswith("/issue"):
            _StrictThenMinimal.create_attempts += 1
            fields = (kwargs.get("json") or {}).get("fields") or {}
            if "timetracking" in fields or "duedate" in fields or "assignee" in fields:
                return _Resp(400, {"errors": {"customfield_10000": "customfield_10000 is required"}})
            return _Resp(201, {"id": "10099", "key": "RWMS-99", "self": "https://jira.example/rest/api/2/issue/10099"})
        if method == "GET" and "/issue/" in url and not url.rstrip("/").endswith("/transitions"):
            return _Resp(200, {
                "id": "10099",
                "key": "RWMS-99",
                "fields": {
                    "summary": "Minimal",
                    "updated": "2026-11-19T12:00:00.000+0000",
                    "status": {"name": "To Do"},
                    "labels": ["remo"],
                },
            })
        if url.endswith("/transitions"):
            return _Resp(200, {"transitions": [{"id": "21", "to": {"name": "To Do"}}]})
        if url.endswith("/remotelink") or url.endswith("/watchers"):
            return _Resp(201, {"id": 1})
        return _Resp(404, {"errorMessages": [f"unhandled {method} {url}"]})


class _PeopleJira(_FakeJira):
    async def request(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs.get("json")))
        _FakeJira.calls.append((method, url, kwargs.get("json")))
        if "/user/assignable/search" in url:
            return _Resp(200, [
                {"name": "alice", "displayName": "Alice A", "emailAddress": "a@example.com", "active": True},
                {"name": "bob", "displayName": "Bob B", "emailAddress": "b@example.com", "active": True},
                {"name": "ghost", "displayName": "Ghost", "active": False},
            ])
        return _Resp(404, {"errorMessages": [f"unhandled {method} {url}"]})


async def test_preview_and_import_jira_people(client, manager_token, monkeypatch):
    monkeypatch.setattr("app.modules.jira.client.httpx.AsyncClient", _PeopleJira)
    saved = await client.put("/api/v1/jira/connection", json=_connection_body(), headers=_auth(manager_token))
    assert saved.status_code == 200, saved.text

    preview = await client.get("/api/v1/jira/people/preview", headers=_auth(manager_token))
    assert preview.status_code == 200, preview.text
    rows = preview.json()
    names = {row["jira_username"] for row in rows}
    assert names == {"alice", "bob"}
    assert all(row["status"] == "unmatched" for row in rows)

    imported = await client.post(
        "/api/v1/jira/people/import",
        json={
            "default_role": "MEMBER",
            "people": [
                {"jira_username": "alice", "jira_display_name": "Alice A", "jira_email": "a@example.com"},
                {"jira_username": "bob", "jira_display_name": "Bob B", "role": "SUPERVISOR"},
            ],
        },
        headers=_auth(manager_token),
    )
    assert imported.status_code == 200, imported.text
    body = imported.json()
    assert body["created_count"] == 2
    assert body["linked_count"] == 0
    assert all(item["temporary_password"] for item in body["imported"] if item["action"] == "created")

    maps = await client.get("/api/v1/jira/user-map", headers=_auth(manager_token))
    mapped = {row["jira_username"]: row["remo_user_id"] for row in maps.json()}
    assert mapped["alice"] and mapped["bob"]

    again = await client.get("/api/v1/jira/people/preview", headers=_auth(manager_token))
    assert all(row["status"] == "mapped" for row in again.json())


async def test_push_create_retries_minimal_fields(client, manager_token, monkeypatch):
    monkeypatch.setenv("JIRA_SYNC_INLINE", "1")
    _FakeJira.calls = []
    _StrictThenMinimal.create_attempts = 0
    monkeypatch.setattr("app.modules.jira.client.httpx.AsyncClient", _StrictThenMinimal)

    _, sup_token, _ = await _create_and_login(client, manager_token, role="SUPERVISOR")
    member_id, _, _ = await _create_and_login(client, sup_token, role="MEMBER")
    saved = await client.put("/api/v1/jira/connection", json=_connection_body(), headers=_auth(manager_token))
    assert saved.status_code == 200, saved.text

    created = await client.post(
        "/api/v1/tasks",
        json=_task_body(assignee_ids=[member_id], estimate_minutes=60),
        headers=_auth(sup_token),
    )
    assert created.status_code == 201, created.text
    body = created.json()["tasks"][0]
    # Local task survives; sync recovers via minimal create.
    assert body["jira_issue_key"] == "RWMS-99"
    assert body["jira_sync_status"] == "synced"
    assert _StrictThenMinimal.create_attempts >= 2
    detail = await client.get(f"/api/v1/tasks/{body['id']}", headers=_auth(sup_token))
    assert any(event["action"] == "sync_warning" for event in detail.json()["events"])


def _issue(issue_id, key, summary, assignee, project="RWMS", status="In Progress"):
    return {
        "id": issue_id,
        "key": key,
        "self": f"https://jira.example/rest/api/2/issue/{issue_id}",
        "fields": {
            "summary": summary,
            "description": "from jira",
            "duedate": "2026-11-30",
            "priority": {"name": "High"},
            "labels": ["remote"],
            "assignee": {"name": assignee, "displayName": assignee},
            "reporter": {"name": assignee},
            "status": {"name": status},
            "timetracking": {"originalEstimate": "2h 30m", "originalEstimateSeconds": 9000},
            "updated": "2026-11-19T10:00:00.000+0000",
            "project": {"key": project},
        },
    }


async def test_webhook_user_map_and_pull(client, manager_token, monkeypatch):
    _, sup_token, _ = await _create_and_login(client, manager_token, role="SUPERVISOR")
    member_id, member_token, username = await _create_and_login(client, sup_token, role="MEMBER")
    _, other_token, _ = await _create_and_login(client, sup_token, role="MEMBER")

    saved = await client.put("/api/v1/jira/connection", json=_connection_body(), headers=_auth(manager_token))
    assert saved.status_code == 200, saved.text
    secret = saved.json()["webhook_secret"]

    mapped = await client.put(
        "/api/v1/jira/user-map",
        json={"items": [{"jira_username": "jdoe", "remo_user_id": member_id}]},
        headers=_auth(manager_token),
    )
    assert mapped.status_code == 200, mapped.text

    denied = await client.post("/api/v1/jira/webhook", json={"issue": {}}, params={"secret": "nope"})
    assert denied.status_code == 401

    created = await client.post(
        "/api/v1/jira/webhook",
        params={"secret": secret},
        json={"webhookEvent": "jira:issue_created", "issue": _issue("501", "RWMS-9", "From Jira", "jdoe")},
    )
    assert created.status_code == 200, created.text

    listing = await client.get("/api/v1/tasks", headers=_auth(member_token))
    assert listing.status_code == 200
    rows = listing.json()
    assert len(rows) == 1
    assert rows[0]["title"] == "From Jira"
    assert rows[0]["status"] == "in_progress"
    assert rows[0]["estimate_minutes"] == 150
    assert rows[0]["priority"] == "high"
    assert rows[0]["jira_issue_key"] == "RWMS-9"
    assert rows[0]["labels"][0]["title"] == "remote"

    hidden = await client.get("/api/v1/tasks", headers=_auth(other_token))
    assert hidden.json() == []

    updated = await client.post(
        "/api/v1/jira/webhook",
        params={"secret": secret},
        json={"webhookEvent": "jira:issue_updated", "issue": _issue("501", "RWMS-9", "Renamed", "jdoe")},
    )
    assert updated.status_code == 200
    again = await client.get("/api/v1/tasks", headers=_auth(member_token))
    assert len(again.json()) == 1
    assert again.json()[0]["title"] == "Renamed"

    deleted = await client.post(
        "/api/v1/jira/webhook",
        headers={"X-Remo-Webhook-Secret": secret},
        json={"webhookEvent": "jira:issue_deleted", "issue": {"id": "501", "key": "RWMS-9"}},
    )
    assert deleted.status_code == 200, deleted.text
    after_delete = await client.get(f"/api/v1/tasks/{again.json()[0]['id']}", headers=_auth(member_token))
    assert after_delete.json()["status"] == "cancelled"

    class _Search( _FakeJira):
        async def request(self, method, url, **kwargs):
            if url.endswith("/search"):
                return _Resp(200, {
                    "issues": [
                        _issue("777", "RWMS-3", "Polled", username, status="To Do"),
                        _issue("778", "OTHER-1", "Ignore me", username, project="OTHER"),
                    ],
                    "total": 2,
                })
            return _Resp(404, {"errorMessages": ["unexpected"]})

    monkeypatch.setattr("app.modules.jira.client.httpx.AsyncClient", _Search)
    pulled = await client.post("/api/v1/jira/sync/pull", headers=_auth(manager_token))
    assert pulled.status_code == 200, pulled.text
    assert pulled.json()["updated"] == 2
    mine = await client.get("/api/v1/tasks", headers=_auth(member_token))
    titles = {row["title"] for row in mine.json()}
    assert "Polled" in titles
    assert "Ignore me" not in titles

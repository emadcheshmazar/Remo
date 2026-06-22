from tests.conftest import _auth


async def test_work_start_creates_event(client, member_token):
    await client.post("/api/v1/work/start", headers=_auth(member_token))
    r = await client.get("/api/v1/timeline/me/today", headers=_auth(member_token))
    assert r.status_code == 200
    types = [e["event_type"] for e in r.json()]
    assert "SESSION_START" in types


async def test_work_end_creates_event(client, member_token):
    await client.post("/api/v1/work/start", headers=_auth(member_token))
    await client.post("/api/v1/work/end", headers=_auth(member_token))
    r = await client.get("/api/v1/timeline/me/today", headers=_auth(member_token))
    types = [e["event_type"] for e in r.json()]
    assert "SESSION_END" in types


async def test_status_change_creates_event(client, member_token):
    await client.patch("/api/v1/status/me", json={"status": "AVAILABLE"}, headers=_auth(member_token))
    r = await client.get("/api/v1/timeline/me/today", headers=_auth(member_token))
    types = [e["event_type"] for e in r.json()]
    assert "STATUS_CHANGE" in types


async def test_report_submit_creates_event(client, member_token):
    await client.put(
        "/api/v1/reports/today",
        json={"today_text": "done", "blockers_text": "", "tomorrow_text": "more"},
        headers=_auth(member_token),
    )
    r = await client.get("/api/v1/timeline/me/today", headers=_auth(member_token))
    types = [e["event_type"] for e in r.json()]
    assert "REPORT_SUBMITTED" in types


async def test_timeline_ordered_chronologically(client, member_token):
    await client.post("/api/v1/work/start", headers=_auth(member_token))
    await client.patch("/api/v1/status/me", json={"status": "FOCUS"}, headers=_auth(member_token))
    await client.post("/api/v1/work/end", headers=_auth(member_token))
    r = await client.get("/api/v1/timeline/me/today", headers=_auth(member_token))
    events = r.json()
    times = [e["occurred_at"] for e in events]
    assert times == sorted(times)


async def test_full_timeline(client, member, member_token):
    await client.post("/api/v1/work/start", headers=_auth(member_token))
    r = await client.get(f"/api/v1/timeline/{member.id}", headers=_auth(member_token))
    assert r.status_code == 200
    assert len(r.json()) >= 1

from tests.conftest import _auth

REPORT = {
    "today_text": "Finished the auth module",
    "blockers_text": "None",
    "tomorrow_text": "Start on the users module",
}


async def test_submit_today_report(client, member_token):
    r = await client.put("/api/v1/reports/today", json=REPORT, headers=_auth(member_token))
    assert r.status_code == 200
    data = r.json()
    assert data["today_text"] == REPORT["today_text"]


async def test_upsert_updates_existing(client, member_token):
    await client.put("/api/v1/reports/today", json=REPORT, headers=_auth(member_token))
    updated = {**REPORT, "today_text": "Updated work"}
    r = await client.put("/api/v1/reports/today", json=updated, headers=_auth(member_token))
    assert r.status_code == 200
    assert r.json()["today_text"] == "Updated work"


async def test_get_today_report(client, member_token):
    await client.put("/api/v1/reports/today", json=REPORT, headers=_auth(member_token))
    r = await client.get("/api/v1/reports/today", headers=_auth(member_token))
    assert r.status_code == 200
    assert r.json()["today_text"] == REPORT["today_text"]


async def test_no_report_returns_null(client, member_token):
    r = await client.get("/api/v1/reports/today", headers=_auth(member_token))
    assert r.status_code == 200
    assert r.json() is None


async def test_report_history(client, member_token):
    await client.put("/api/v1/reports/today", json=REPORT, headers=_auth(member_token))
    r = await client.get("/api/v1/reports/me", headers=_auth(member_token))
    assert r.status_code == 200
    assert len(r.json()) >= 1

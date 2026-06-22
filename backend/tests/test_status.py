from tests.conftest import _auth


async def test_get_my_status_default(client, member_token):
    r = await client.get("/api/v1/status/me", headers=_auth(member_token))
    assert r.status_code == 200
    # no status record yet → null
    assert r.json() is None


async def test_update_status(client, member_token):
    r = await client.patch("/api/v1/status/me", json={"status": "AVAILABLE"}, headers=_auth(member_token))
    assert r.status_code == 200
    assert r.json()["status"] == "AVAILABLE"


async def test_status_persists(client, member_token):
    await client.patch("/api/v1/status/me", json={"status": "FOCUS"}, headers=_auth(member_token))
    r = await client.get("/api/v1/status/me", headers=_auth(member_token))
    assert r.json()["status"] == "FOCUS"


async def test_invalid_status_rejected(client, member_token):
    r = await client.patch("/api/v1/status/me", json={"status": "SLEEPING"}, headers=_auth(member_token))
    assert r.status_code == 422


async def test_get_all_statuses(client, member_token, supervisor_token):
    await client.patch("/api/v1/status/me", json={"status": "MEETING"}, headers=_auth(member_token))
    r = await client.get("/api/v1/status", headers=_auth(supervisor_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


async def test_status_log_created(client, member, member_token):
    await client.patch("/api/v1/status/me", json={"status": "BREAK"}, headers=_auth(member_token))
    r = await client.get(f"/api/v1/status/{member.id}/log", headers=_auth(member_token))
    assert r.status_code == 200
    log = r.json()
    assert len(log) >= 1
    assert log[0]["status"] == "BREAK"

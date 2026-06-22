from tests.conftest import _auth


async def test_start_session(client, member_token):
    r = await client.post("/api/v1/work/start", headers=_auth(member_token))
    assert r.status_code == 201
    assert r.json()["ended_at"] is None


async def test_cannot_start_twice(client, member_token):
    await client.post("/api/v1/work/start", headers=_auth(member_token))
    r = await client.post("/api/v1/work/start", headers=_auth(member_token))
    assert r.status_code == 409


async def test_end_session(client, member_token):
    await client.post("/api/v1/work/start", headers=_auth(member_token))
    r = await client.post("/api/v1/work/end", headers=_auth(member_token))
    assert r.status_code == 200
    assert r.json()["ended_at"] is not None
    assert r.json()["duration_minutes"] is not None


async def test_end_without_start(client, member_token):
    r = await client.post("/api/v1/work/end", headers=_auth(member_token))
    assert r.status_code == 404


async def test_summary_today(client, member_token):
    await client.post("/api/v1/work/start", headers=_auth(member_token))
    await client.post("/api/v1/work/end", headers=_auth(member_token))
    r = await client.get("/api/v1/work/summary", headers=_auth(member_token))
    assert r.status_code == 200
    data = r.json()
    assert "total_minutes_today" in data
    assert "session" in data


async def test_history(client, member_token):
    await client.post("/api/v1/work/start", headers=_auth(member_token))
    await client.post("/api/v1/work/end", headers=_auth(member_token))
    r = await client.get("/api/v1/work/history", headers=_auth(member_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert len(r.json()) >= 1

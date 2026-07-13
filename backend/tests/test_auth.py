import uuid

from tests.conftest import _auth, _login


async def test_login_success(client, member):
    r = await client.post("/api/v1/auth/login", json={"username": member.username, "password": "pass123"})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["user"]["username"] == member.username
    assert data["user"]["role"] == "MEMBER"


async def test_login_wrong_password(client, member):
    r = await client.post("/api/v1/auth/login", json={"username": member.username, "password": "wrong"})
    assert r.status_code == 401


async def test_login_unknown_user(client):
    r = await client.post("/api/v1/auth/login", json={"username": "nobody", "password": "x"})
    assert r.status_code == 401


async def test_me_returns_current_user(client, member, member_token):
    r = await client.get("/api/v1/auth/me", headers=_auth(member_token))
    assert r.status_code == 200
    assert r.json()["username"] == member.username


async def test_me_requires_auth(client):
    r = await client.get("/api/v1/auth/me")
    assert r.status_code == 401


async def test_change_password(client, member, member_token):
    r = await client.patch(
        "/api/v1/auth/me/password",
        json={"current_password": "pass123", "new_password": "newpass456"},
        headers=_auth(member_token),
    )
    assert r.status_code in (200, 204)
    # old password no longer works
    r2 = await client.post("/api/v1/auth/login", json={"username": member.username, "password": "pass123"})
    assert r2.status_code == 401
    # new password works
    r3 = await client.post("/api/v1/auth/login", json={"username": member.username, "password": "newpass456"})
    assert r3.status_code == 200


async def test_change_password_wrong_current(client, member, member_token):
    r = await client.patch(
        "/api/v1/auth/me/password",
        json={"current_password": "wrong", "new_password": "newpass"},
        headers=_auth(member_token),
    )
    assert r.status_code == 400


async def test_deactivated_user_token_immediately_rejected(client, manager_token):
    username = f"deact_{uuid.uuid4().hex[:6]}"
    create = await client.post(
        "/api/v1/users",
        json={"username": username, "password": "pass123", "full_name": "D", "role": "MEMBER"},
        headers=_auth(manager_token),
    )
    user_id = create.json()["id"]
    token = (await _login(client, username, "pass123"))

    r = await client.get("/api/v1/auth/me", headers=_auth(token))
    assert r.status_code == 200

    # deactivate the account — the still-unexpired token must stop working
    # immediately, not just after it naturally expires
    await client.patch(f"/api/v1/users/{user_id}", json={"is_active": False}, headers=_auth(manager_token))

    r2 = await client.get("/api/v1/auth/me", headers=_auth(token))
    assert r2.status_code == 401

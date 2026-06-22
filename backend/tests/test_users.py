import uuid

from tests.conftest import _auth


async def test_admin_creates_manager(client, admin_token):
    r = await client.post(
        "/api/v1/users",
        json={"username": f"mgr_{uuid.uuid4().hex[:6]}", "password": "pass123", "full_name": "New Mgr", "role": "MANAGER"},
        headers=_auth(admin_token),
    )
    assert r.status_code == 201
    assert r.json()["role"] == "MANAGER"


async def test_admin_cannot_create_admin(client, admin_token):
    r = await client.post(
        "/api/v1/users",
        json={"username": f"adm_{uuid.uuid4().hex[:6]}", "password": "pass123", "full_name": "Bad Admin", "role": "ADMIN"},
        headers=_auth(admin_token),
    )
    assert r.status_code == 403


async def test_manager_creates_member(client, manager_token):
    r = await client.post(
        "/api/v1/users",
        json={"username": f"mbr_{uuid.uuid4().hex[:6]}", "password": "pass123", "full_name": "New Member", "role": "MEMBER"},
        headers=_auth(manager_token),
    )
    assert r.status_code == 201


async def test_manager_cannot_create_manager(client, manager_token):
    r = await client.post(
        "/api/v1/users",
        json={"username": f"mgr2_{uuid.uuid4().hex[:6]}", "password": "pass123", "full_name": "Bad Mgr", "role": "MANAGER"},
        headers=_auth(manager_token),
    )
    assert r.status_code == 403


async def test_supervisor_creates_member(client, supervisor_token):
    r = await client.post(
        "/api/v1/users",
        json={"username": f"mbr_{uuid.uuid4().hex[:6]}", "password": "pass123", "full_name": "New Mbr", "role": "MEMBER"},
        headers=_auth(supervisor_token),
    )
    assert r.status_code == 201


async def test_supervisor_cannot_create_supervisor(client, supervisor_token):
    r = await client.post(
        "/api/v1/users",
        json={"username": f"sup2_{uuid.uuid4().hex[:6]}", "password": "pass123", "full_name": "Bad Sup", "role": "SUPERVISOR"},
        headers=_auth(supervisor_token),
    )
    assert r.status_code == 403


async def test_member_cannot_create_anyone(client, member_token):
    r = await client.post(
        "/api/v1/users",
        json={"username": f"x_{uuid.uuid4().hex[:6]}", "password": "pass123", "full_name": "X", "role": "MEMBER"},
        headers=_auth(member_token),
    )
    assert r.status_code == 403


async def test_list_users_returns_only_manageable(client, admin_token, manager_token):
    # admin creates a manager
    await client.post(
        "/api/v1/users",
        json={"username": f"mgr_{uuid.uuid4().hex[:6]}", "password": "p", "full_name": "M", "role": "MANAGER"},
        headers=_auth(admin_token),
    )
    # manager's list should only contain SUPERVISOR and MEMBER (none yet)
    r = await client.get("/api/v1/users", headers=_auth(manager_token))
    assert r.status_code == 200
    roles = {u["role"] for u in r.json()}
    assert "ADMIN" not in roles
    assert "MANAGER" not in roles


async def test_update_user(client, admin_token):
    create = await client.post(
        "/api/v1/users",
        json={"username": f"mgr_{uuid.uuid4().hex[:6]}", "password": "pass", "full_name": "Old Name", "role": "MANAGER"},
        headers=_auth(admin_token),
    )
    uid = create.json()["id"]
    r = await client.patch(f"/api/v1/users/{uid}", json={"full_name": "New Name"}, headers=_auth(admin_token))
    assert r.status_code == 200
    assert r.json()["full_name"] == "New Name"


async def test_delete_user(client, admin_token):
    create = await client.post(
        "/api/v1/users",
        json={"username": f"mgr_{uuid.uuid4().hex[:6]}", "password": "pass", "full_name": "To Delete", "role": "MANAGER"},
        headers=_auth(admin_token),
    )
    uid = create.json()["id"]
    r = await client.delete(f"/api/v1/users/{uid}", headers=_auth(admin_token))
    assert r.status_code == 204


async def test_duplicate_username_rejected(client, admin_token):
    uname = f"dup_{uuid.uuid4().hex[:6]}"
    payload = {"username": uname, "password": "p", "full_name": "F", "role": "MANAGER"}
    r1 = await client.post("/api/v1/users", json=payload, headers=_auth(admin_token))
    assert r1.status_code == 201
    r2 = await client.post("/api/v1/users", json=payload, headers=_auth(admin_token))
    assert r2.status_code == 409

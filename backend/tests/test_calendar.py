import uuid

from tests.conftest import _auth


async def _create_and_login(client, creator_token, *, role, password="pass123"):
    username = f"{role.lower()}_{uuid.uuid4().hex[:6]}"
    r = await client.post(
        "/api/v1/users",
        json={"username": username, "password": password, "full_name": role.title(), "role": role},
        headers=_auth(creator_token),
    )
    assert r.status_code == 201, r.text
    user_id = r.json()["id"]
    login = await client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert login.status_code == 200, login.text
    return user_id, login.json()["access_token"]


async def test_member_sees_teammates_under_other_supervisors(client, manager_token):
    sup1_id, sup1_token = await _create_and_login(client, manager_token, role="SUPERVISOR")
    sup2_id, sup2_token = await _create_and_login(client, manager_token, role="SUPERVISOR")
    mbr1_id, mbr1_token = await _create_and_login(client, sup1_token, role="MEMBER")
    mbr2_id, _ = await _create_and_login(client, sup2_token, role="MEMBER")

    # member 1 (under supervisor 1) should also see member 2 (under supervisor 2)
    # and both supervisors, since they all share the same manager
    r = await client.get("/api/v1/calendar/team-users", headers=_auth(mbr1_token))
    assert r.status_code == 200
    ids = {u["id"] for u in r.json()}
    assert mbr2_id in ids
    assert sup1_id in ids
    assert sup2_id in ids


async def test_supervisor_sees_whole_manager_org_not_just_own_team(client, manager_token):
    sup1_id, sup1_token = await _create_and_login(client, manager_token, role="SUPERVISOR")
    sup2_id, sup2_token = await _create_and_login(client, manager_token, role="SUPERVISOR")
    mbr2_id, _ = await _create_and_login(client, sup2_token, role="MEMBER")

    # supervisor 1 should also see supervisor 2 and supervisor 2's member,
    # since they all share the same manager — not just their own direct team
    r = await client.get("/api/v1/calendar/team-users", headers=_auth(sup1_token))
    assert r.status_code == 200
    ids = {u["id"] for u in r.json()}
    assert sup2_id in ids
    assert mbr2_id in ids


async def test_supervisor_sees_but_cannot_open_details_of_other_supervisors_member(client, manager_token):
    sup1_id, sup1_token = await _create_and_login(client, manager_token, role="SUPERVISOR")
    sup2_id, sup2_token = await _create_and_login(client, manager_token, role="SUPERVISOR")
    mbr2_id, _ = await _create_and_login(client, sup2_token, role="MEMBER")

    # supervisor 1 sees member 2 in the org-wide list (remote/leave visibility)...
    r = await client.get("/api/v1/calendar/team-users", headers=_auth(sup1_token))
    assert mbr2_id in {u["id"] for u in r.json()}

    # ...but cannot open member 2's day detail — that's a different supervisor's team
    r = await client.get(
        f"/api/v1/calendar/{mbr2_id}/stats", params={"date": "2026-07-08"}, headers=_auth(sup1_token)
    )
    assert r.status_code == 403


async def test_member_without_manager_sees_only_self(client, member_token, member):
    r = await client.get("/api/v1/calendar/team-users", headers=_auth(member_token))
    assert r.status_code == 200
    ids = {u["id"] for u in r.json()}
    assert ids == {str(member.id)}


async def test_manager_cannot_set_day_notes(client, manager_token):
    sup_id, sup_token = await _create_and_login(client, manager_token, role="SUPERVISOR")
    mbr_id, _ = await _create_and_login(client, sup_token, role="MEMBER")

    r = await client.put(
        f"/api/v1/calendar/{mbr_id}/2026-07-08", json={"day_type": "REMOTE"}, headers=_auth(manager_token)
    )
    assert r.status_code == 200

    r = await client.patch(
        f"/api/v1/calendar/{mbr_id}/2026-07-08/notes", json={"notes": "manager trying to write a note"},
        headers=_auth(manager_token),
    )
    assert r.status_code == 403


async def test_supervisor_can_set_notes_for_own_member(client, manager_token):
    sup_id, sup_token = await _create_and_login(client, manager_token, role="SUPERVISOR")
    mbr_id, _ = await _create_and_login(client, sup_token, role="MEMBER")

    r = await client.put(
        f"/api/v1/calendar/{mbr_id}/2026-07-08", json={"day_type": "REMOTE"}, headers=_auth(sup_token)
    )
    assert r.status_code == 200

    r = await client.patch(
        f"/api/v1/calendar/{mbr_id}/2026-07-08/notes", json={"notes": "working from home today"},
        headers=_auth(sup_token),
    )
    assert r.status_code == 200
    assert r.json()["notes"] == "working from home today"

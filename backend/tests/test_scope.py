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


async def _two_managers_with_members(client, admin_token):
    """Two unrelated MANAGER orgs, each with one MEMBER, for cross-org checks."""
    _, mgr_a_token = await _create_and_login(client, admin_token, role="MANAGER")
    _, mgr_b_token = await _create_and_login(client, admin_token, role="MANAGER")
    mbr_a_id, mbr_a_token = await _create_and_login(client, mgr_a_token, role="MEMBER")
    mbr_b_id, _ = await _create_and_login(client, mgr_b_token, role="MEMBER")
    return mgr_a_token, mgr_b_token, mbr_a_id, mbr_a_token, mbr_b_id


async def test_manager_cannot_view_other_managers_member(client, admin_token):
    mgr_a_token, mgr_b_token, mbr_a_id, _, mbr_b_id = await _two_managers_with_members(client, admin_token)

    r = await client.get(f"/api/v1/users/{mbr_b_id}", headers=_auth(mgr_a_token))
    assert r.status_code == 403

    r = await client.get(f"/api/v1/users/{mbr_a_id}", headers=_auth(mgr_a_token))
    assert r.status_code == 200


async def test_manager_cannot_delete_other_managers_member(client, admin_token):
    mgr_a_token, mgr_b_token, mbr_a_id, _, mbr_b_id = await _two_managers_with_members(client, admin_token)

    r = await client.delete(f"/api/v1/users/{mbr_b_id}", headers=_auth(mgr_a_token))
    assert r.status_code == 403

    r = await client.delete(f"/api/v1/users/{mbr_a_id}", headers=_auth(mgr_a_token))
    assert r.status_code == 204


async def test_get_user_nonexistent_returns_404(client, manager_token):
    fake_id = str(uuid.uuid4())
    r = await client.get(f"/api/v1/users/{fake_id}", headers=_auth(manager_token))
    assert r.status_code == 404


async def test_status_log_blocked_across_orgs(client, admin_token):
    mgr_a_token, mgr_b_token, mbr_a_id, mbr_a_token, mbr_b_id = await _two_managers_with_members(client, admin_token)

    # member A can read their own log
    r = await client.get(f"/api/v1/status/{mbr_a_id}/log", headers=_auth(mbr_a_token))
    assert r.status_code == 200

    # member A cannot read member B's log (different manager's org)
    r = await client.get(f"/api/v1/status/{mbr_b_id}/log", headers=_auth(mbr_a_token))
    assert r.status_code == 403

    # manager B *can* read member B's log (their own org)
    r = await client.get(f"/api/v1/status/{mbr_b_id}/log", headers=_auth(mgr_b_token))
    assert r.status_code == 200


async def test_calendar_day_stats_blocked_across_orgs(client, admin_token):
    mgr_a_token, mgr_b_token, mbr_a_id, mbr_a_token, mbr_b_id = await _two_managers_with_members(client, admin_token)

    r = await client.get(
        f"/api/v1/calendar/{mbr_b_id}/stats", params={"date": "2026-07-08"}, headers=_auth(mbr_a_token)
    )
    assert r.status_code == 403

    r = await client.get(
        f"/api/v1/calendar/{mbr_a_id}/stats", params={"date": "2026-07-08"}, headers=_auth(mbr_a_token)
    )
    assert r.status_code == 200


async def test_calendar_set_day_blocked_for_manager_outside_org(client, admin_token):
    mgr_a_token, mgr_b_token, mbr_a_id, _, mbr_b_id = await _two_managers_with_members(client, admin_token)

    r = await client.put(
        f"/api/v1/calendar/{mbr_b_id}/2026-07-08", json={"day_type": "REMOTE"}, headers=_auth(mgr_a_token)
    )
    assert r.status_code == 403

    r = await client.put(
        f"/api/v1/calendar/{mbr_a_id}/2026-07-08", json={"day_type": "REMOTE"}, headers=_auth(mgr_a_token)
    )
    assert r.status_code == 200


async def test_reports_date_path_rejects_malformed_date(client, member_token, member):
    r = await client.get(f"/api/v1/reports/{member.id}/not-a-date", headers=_auth(member_token))
    assert r.status_code == 422

"""
Tests for /v0/teams endpoints.
"""

import hashlib

# ── Helpers ────────────────────────────────────────────────────────────────────


def _register_and_login(client, email: str) -> dict:
    client.post(
        "/v0/auth/register",
        json={"email": email, "password": "securepass123"},
    )
    res = client.post(
        "/v0/auth/login",
        json={"email": email, "password": "securepass123"},
    )
    return res.json()


def _auth_headers(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def _create_team(client, headers: dict, name: str = "My Team") -> dict:
    res = client.post("/v0/teams", json={"name": name}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def _make_hash(text: str = "sample code") -> str:
    return hashlib.sha256(text.encode()).hexdigest()


# ── List teams ─────────────────────────────────────────────────────────────────


def test_list_teams_empty(client):
    tokens = _register_and_login(client, "list_teams_empty@example.com")
    res = client.get("/v0/teams", headers=_auth_headers(tokens))
    assert res.status_code == 200
    assert res.json() == []


def test_list_teams_unauthenticated(client):
    res = client.get("/v0/teams")
    assert res.status_code in (401, 403)


# ── Create team ────────────────────────────────────────────────────────────────


def test_create_team_success(client):
    tokens = _register_and_login(client, "create_team@example.com")
    headers = _auth_headers(tokens)
    data = _create_team(client, headers, name="Alpha Squad")
    assert data["name"] == "Alpha Squad"
    assert "team_id" in data
    assert "owner_id" in data


def test_create_team_appears_in_list(client):
    tokens = _register_and_login(client, "create_list@example.com")
    headers = _auth_headers(tokens)
    created = _create_team(client, headers, name="Beta Team")

    res = client.get("/v0/teams", headers=headers)
    ids = [t["team_id"] for t in res.json()]
    assert created["team_id"] in ids


def test_create_team_unauthenticated(client):
    res = client.post("/v0/teams", json={"name": "Ghost"})
    assert res.status_code in (401, 403)


# ── Get team ───────────────────────────────────────────────────────────────────


def test_get_team_success(client):
    tokens = _register_and_login(client, "get_team@example.com")
    headers = _auth_headers(tokens)
    created = _create_team(client, headers)

    res = client.get(f"/v0/teams/{created['team_id']}", headers=headers)
    assert res.status_code == 200
    assert res.json()["team_id"] == created["team_id"]


def test_get_team_non_member_returns_403(client):
    tok_a = _register_and_login(client, "owner_get@example.com")
    tok_b = _register_and_login(client, "outsider_get@example.com")

    team = _create_team(client, _auth_headers(tok_a))

    res = client.get(f"/v0/teams/{team['team_id']}", headers=_auth_headers(tok_b))
    assert res.status_code == 403


def test_get_team_invalid_id_returns_404(client):
    tokens = _register_and_login(client, "invalid_id@example.com")
    res = client.get("/v0/teams/not-a-uuid", headers=_auth_headers(tokens))
    assert res.status_code == 404


# ── List members ───────────────────────────────────────────────────────────────


def test_list_members_contains_owner(client):
    tokens = _register_and_login(client, "owner_members@example.com")
    headers = _auth_headers(tokens)
    team = _create_team(client, headers)

    res = client.get(f"/v0/teams/{team['team_id']}/members", headers=headers)
    assert res.status_code == 200
    members = res.json()
    assert len(members) == 1
    assert members[0]["role"] == "owner"
    assert members[0]["email"] == "owner_members@example.com"


def test_list_members_non_member_returns_403(client):
    tok_a = _register_and_login(client, "owner_lm@example.com")
    tok_b = _register_and_login(client, "outsider_lm@example.com")
    team = _create_team(client, _auth_headers(tok_a))

    res = client.get(f"/v0/teams/{team['team_id']}/members", headers=_auth_headers(tok_b))
    assert res.status_code == 403


# ── Add member ─────────────────────────────────────────────────────────────────


def test_add_member_success(client):
    tok_owner = _register_and_login(client, "owner_add@example.com")
    tok_target = _register_and_login(client, "target_add@example.com")
    headers_owner = _auth_headers(tok_owner)

    team = _create_team(client, headers_owner)

    res = client.post(
        f"/v0/teams/{team['team_id']}/members",
        json={"email": "target_add@example.com", "role": "member"},
        headers=headers_owner,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == "target_add@example.com"
    assert data["role"] == "member"

    # target can now list members
    members_res = client.get(
        f"/v0/teams/{team['team_id']}/members", headers=_auth_headers(tok_target)
    )
    assert members_res.status_code == 200
    assert len(members_res.json()) == 2


def test_add_member_non_admin_returns_403(client):
    tok_owner = _register_and_login(client, "owner_403@example.com")
    tok_member = _register_and_login(client, "member_403@example.com")
    _register_and_login(client, "target_403@example.com")

    team = _create_team(client, _auth_headers(tok_owner))

    # Make tok_member a plain member first
    client.post(
        f"/v0/teams/{team['team_id']}/members",
        json={"email": "member_403@example.com", "role": "member"},
        headers=_auth_headers(tok_owner),
    )

    # plain member tries to add someone
    res = client.post(
        f"/v0/teams/{team['team_id']}/members",
        json={"email": "target_403@example.com", "role": "member"},
        headers=_auth_headers(tok_member),
    )
    assert res.status_code == 403


def test_add_member_duplicate_returns_409(client):
    tok_owner = _register_and_login(client, "owner_dup@example.com")
    _register_and_login(client, "dup_target@example.com")
    headers = _auth_headers(tok_owner)
    team = _create_team(client, headers)

    client.post(
        f"/v0/teams/{team['team_id']}/members",
        json={"email": "dup_target@example.com", "role": "member"},
        headers=headers,
    )
    res = client.post(
        f"/v0/teams/{team['team_id']}/members",
        json={"email": "dup_target@example.com", "role": "member"},
        headers=headers,
    )
    assert res.status_code == 409


def test_add_member_unknown_user_returns_404(client):
    tokens = _register_and_login(client, "owner_unk@example.com")
    headers = _auth_headers(tokens)
    team = _create_team(client, headers)

    res = client.post(
        f"/v0/teams/{team['team_id']}/members",
        json={"email": "nobody@example.com", "role": "member"},
        headers=headers,
    )
    assert res.status_code == 404


def test_add_member_invalid_role_returns_422(client):
    tokens = _register_and_login(client, "owner_role@example.com")
    _register_and_login(client, "role_target@example.com")
    headers = _auth_headers(tokens)
    team = _create_team(client, headers)

    res = client.post(
        f"/v0/teams/{team['team_id']}/members",
        json={"email": "role_target@example.com", "role": "owner"},
        headers=headers,
    )
    assert res.status_code == 422


# ── Results team_id filter ─────────────────────────────────────────────────────


def test_list_results_with_team_id(client):
    tok_owner = _register_and_login(client, "res_owner@example.com")
    headers = _auth_headers(tok_owner)
    team = _create_team(client, headers)

    # Save a result (no team_id on it — extension sets team_id)
    res = client.post(
        "/v0/results",
        json={
            "language": "python",
            "mode": "quick",
            "code_hash": _make_hash("team-code"),
            "findings": [],
            "model_used": "gpt-4o",
            "demo_mode": False,
            "analyzed_at": "2026-04-01T10:00:00Z",
        },
        headers=headers,
    )
    assert res.status_code == 201

    # Team filter returns 0 since result has no team_id set
    team_res = client.get(f"/v0/results?team_id={team['team_id']}", headers=headers)
    assert team_res.status_code == 200
    assert team_res.json()["total"] == 0


def test_list_results_team_id_non_member_returns_403(client):
    tok_a = _register_and_login(client, "res_ownera@example.com")
    tok_b = _register_and_login(client, "res_outsider@example.com")
    team = _create_team(client, _auth_headers(tok_a))

    res = client.get(f"/v0/results?team_id={team['team_id']}", headers=_auth_headers(tok_b))
    assert res.status_code == 403

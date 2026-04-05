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


# ── Hardening: TeamResponse.created_at ────────────────────────────────────────


def test_team_response_includes_created_at(client):
    tokens = _register_and_login(client, "created_at_check@example.com")
    headers = _auth_headers(tokens)
    team = _create_team(client, headers, name="Timestamp Team")
    assert "created_at" in team
    assert team["created_at"]  # non-empty string


# ── Hardening: save result with team_id ───────────────────────────────────────


def test_save_result_with_team_id_persists(client):
    tokens = _register_and_login(client, "save_team_result@example.com")
    headers = _auth_headers(tokens)
    team = _create_team(client, headers)

    res = client.post(
        "/v0/results",
        json={
            "language": "python",
            "mode": "quick",
            "code_hash": _make_hash("team-scoped-code"),
            "findings": [],
            "model_used": "gpt-4o",
            "demo_mode": False,
            "analyzed_at": "2026-04-01T12:00:00Z",
            "team_id": team["team_id"],
        },
        headers=headers,
    )
    assert res.status_code == 201

    # result should appear in team-scoped list
    list_res = client.get(f"/v0/results?team_id={team['team_id']}", headers=headers)
    assert list_res.status_code == 200
    assert list_res.json()["total"] == 1


def test_save_result_invalid_team_id_returns_422(client):
    tokens = _register_and_login(client, "save_invalid_team@example.com")
    headers = _auth_headers(tokens)

    res = client.post(
        "/v0/results",
        json={
            "language": "python",
            "mode": "quick",
            "code_hash": _make_hash("bad-team-id"),
            "findings": [],
            "model_used": "gpt-4o",
            "demo_mode": False,
            "analyzed_at": "2026-04-01T12:00:00Z",
            "team_id": "not-a-uuid",
        },
        headers=headers,
    )
    assert res.status_code == 422


def test_save_result_non_member_team_id_returns_403(client):
    tok_owner = _register_and_login(client, "nm_owner@example.com")
    tok_other = _register_and_login(client, "nm_other@example.com")

    team = _create_team(client, _auth_headers(tok_owner))

    res = client.post(
        "/v0/results",
        json={
            "language": "python",
            "mode": "quick",
            "code_hash": _make_hash("non-member-team"),
            "findings": [],
            "model_used": "gpt-4o",
            "demo_mode": False,
            "analyzed_at": "2026-04-01T12:00:00Z",
            "team_id": team["team_id"],
        },
        headers=_auth_headers(tok_other),
    )
    assert res.status_code == 403


# ── Hardening: get_result team member access ──────────────────────────────────


def test_get_result_team_member_can_access(client):
    tok_owner = _register_and_login(client, "gr_owner@example.com")
    tok_member = _register_and_login(client, "gr_member@example.com")
    headers_owner = _auth_headers(tok_owner)

    team = _create_team(client, headers_owner)

    # add tok_member to team
    client.post(
        f"/v0/teams/{team['team_id']}/members",
        json={"email": "gr_member@example.com", "role": "member"},
        headers=headers_owner,
    )

    # owner saves a team-scoped result
    save_res = client.post(
        "/v0/results",
        json={
            "language": "python",
            "mode": "quick",
            "code_hash": _make_hash("team-owned-result"),
            "findings": [],
            "model_used": "gpt-4o",
            "demo_mode": False,
            "analyzed_at": "2026-04-01T12:00:00Z",
            "team_id": team["team_id"],
        },
        headers=headers_owner,
    )
    assert save_res.status_code == 201
    result_id = save_res.json()["result_id"]

    # team member can fetch it
    get_res = client.get(f"/v0/results/{result_id}", headers=_auth_headers(tok_member))
    assert get_res.status_code == 200
    assert get_res.json()["result_id"] == result_id


# ── Team analytics summary ─────────────────────────────────────────────────────


def _save_team_result(
    client,
    headers: dict,
    team_id: str,
    language: str = "python",
    mode: str = "quick",
    findings: list | None = None,
    seed: str = "default",
) -> dict:
    if findings is None:
        findings = []
    res = client.post(
        "/v0/results",
        json={
            "language": language,
            "mode": mode,
            "code_hash": _make_hash(seed),
            "findings": findings,
            "model_used": "gpt-4o",
            "demo_mode": False,
            "analyzed_at": "2026-04-01T12:00:00Z",
            "team_id": team_id,
        },
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


def test_analytics_summary_non_member_returns_403(client):
    tok_owner = _register_and_login(client, "anl_owner@example.com")
    tok_other = _register_and_login(client, "anl_outsider@example.com")
    team = _create_team(client, _auth_headers(tok_owner))

    res = client.get(
        f"/v0/teams/{team['team_id']}/analytics/summary",
        headers=_auth_headers(tok_other),
    )
    assert res.status_code == 403
    assert res.json()["detail"] == "not_a_member"


def test_analytics_summary_invalid_team_id_returns_404(client):
    tokens = _register_and_login(client, "anl_invalid@example.com")
    res = client.get(
        "/v0/teams/not-a-uuid/analytics/summary",
        headers=_auth_headers(tokens),
    )
    assert res.status_code == 404


def test_analytics_summary_empty_team(client):
    tokens = _register_and_login(client, "anl_empty@example.com")
    headers = _auth_headers(tokens)
    team = _create_team(client, headers, name="Empty Analytics Team")

    res = client.get(
        f"/v0/teams/{team['team_id']}/analytics/summary",
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total_results"] == 0
    assert data["results_last_7d"] == 0
    assert data["results_last_30d"] == 0
    assert data["active_members_last_30d"] == 0
    # severity/mode/language counts all zero
    for v in data["severity_counts"].values():
        assert v == 0
    for v in data["mode_counts"].values():
        assert v == 0
    for v in data["language_counts"].values():
        assert v == 0


def test_analytics_summary_shape_and_counts(client):
    tok_owner = _register_and_login(client, "anl_shape_owner@example.com")
    tok_member = _register_and_login(client, "anl_shape_member@example.com")
    headers_owner = _auth_headers(tok_owner)
    headers_member = _auth_headers(tok_member)

    team = _create_team(client, headers_owner, name="Shape Analytics Team")
    # Add a second member
    client.post(
        f"/v0/teams/{team['team_id']}/members",
        json={"email": "anl_shape_member@example.com", "role": "member"},
        headers=headers_owner,
    )

    critical_finding = {
        "id": "f1",
        "category": "sql_injection",
        "severity": "critical",
        "title": "SQL Injection",
        "description": "desc",
        "line_start": 1,
        "line_end": 2,
    }

    # Owner saves a Python/quick result with 1 critical finding
    _save_team_result(
        client,
        headers_owner,
        team["team_id"],
        language="python",
        mode="quick",
        findings=[critical_finding],
        seed="shape-py-1",
    )

    # Member saves a TypeScript/learn result with no findings
    _save_team_result(
        client,
        headers_member,
        team["team_id"],
        language="typescript",
        mode="learn",
        findings=[],
        seed="shape-ts-1",
    )

    res = client.get(
        f"/v0/teams/{team['team_id']}/analytics/summary",
        headers=headers_owner,
    )
    assert res.status_code == 200
    data = res.json()

    # Required keys present
    for key in (
        "total_results",
        "results_last_7d",
        "results_last_30d",
        "severity_counts",
        "mode_counts",
        "language_counts",
        "active_members_last_30d",
    ):
        assert key in data, f"missing key: {key}"

    assert data["total_results"] == 2
    # Both results were just created — should appear in 7d and 30d windows
    assert data["results_last_7d"] == 2
    assert data["results_last_30d"] == 2

    # Severity: 1 critical from the first result
    assert data["severity_counts"]["critical"] == 1
    assert data["severity_counts"]["high"] == 0

    # Mode breakdown
    assert data["mode_counts"]["quick"] == 1
    assert data["mode_counts"]["learn"] == 1

    # Language breakdown
    assert data["language_counts"]["python"] == 1
    assert data["language_counts"]["typescript"] == 1

    # Two distinct users contributed
    assert data["active_members_last_30d"] == 2


# ── Team analytics insights ────────────────────────────────────────────────────


def test_insights_non_member_returns_403(client):
    tok_owner = _register_and_login(client, "ins_owner@example.com")
    tok_other = _register_and_login(client, "ins_outsider@example.com")
    team = _create_team(client, _auth_headers(tok_owner))

    res = client.get(
        f"/v0/teams/{team['team_id']}/analytics/insights",
        headers=_auth_headers(tok_other),
    )
    assert res.status_code == 403
    assert res.json()["detail"] == "not_a_member"


def test_insights_invalid_team_returns_404(client):
    tokens = _register_and_login(client, "ins_invalid@example.com")
    res = client.get(
        "/v0/teams/not-a-uuid/analytics/insights",
        headers=_auth_headers(tokens),
    )
    assert res.status_code == 404


def test_insights_empty_team(client):
    tokens = _register_and_login(client, "ins_empty@example.com")
    headers = _auth_headers(tokens)
    team = _create_team(client, headers, name="Empty Insights Team")

    res = client.get(
        f"/v0/teams/{team['team_id']}/analytics/insights",
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()

    # Always 14 daily entries, all zeros
    assert len(data["daily_results_last_14d"]) == 14
    for entry in data["daily_results_last_14d"]:
        assert entry["count"] == 0

    assert data["top_bug_categories_last_30d"] == []
    assert data["top_signatures_last_30d"] == []
    assert data["member_activity_last_30d"] == []


def test_insights_shape_and_data(client):
    tok_owner = _register_and_login(client, "ins_shape_owner@example.com")
    tok_member = _register_and_login(client, "ins_shape_member@example.com")
    headers_owner = _auth_headers(tok_owner)
    headers_member = _auth_headers(tok_member)

    team = _create_team(client, headers_owner, name="Insights Shape Team")
    client.post(
        f"/v0/teams/{team['team_id']}/members",
        json={"email": "ins_shape_member@example.com", "role": "member"},
        headers=headers_owner,
    )

    sql_finding = {
        "id": "f1",
        "category": "sql_injection",
        "severity": "critical",
        "title": "SQL Injection",
        "description": "desc",
        "line_start": 1,
        "line_end": 2,
    }

    # Owner saves 2 results with same code_hash (repeated signature)
    _save_team_result(
        client, headers_owner, team["team_id"], findings=[sql_finding], seed="ins-common"
    )
    _save_team_result(
        client, headers_owner, team["team_id"], findings=[sql_finding], seed="ins-common"
    )
    # Member saves 1 result with a different signature
    _save_team_result(client, headers_member, team["team_id"], findings=[], seed="ins-other")

    res = client.get(
        f"/v0/teams/{team['team_id']}/analytics/insights",
        headers=headers_owner,
    )
    assert res.status_code == 200
    data = res.json()

    # Shape checks
    for key in (
        "daily_results_last_14d",
        "top_bug_categories_last_30d",
        "top_signatures_last_30d",
        "member_activity_last_30d",
    ):
        assert key in data, f"missing key: {key}"

    # 14-day daily entries; total for today should be 3
    assert len(data["daily_results_last_14d"]) == 14
    today_count = data["daily_results_last_14d"][-1]["count"]
    assert today_count == 3

    # Categories: sql_injection appears in 2 findings
    cats = {c["category"]: c["count"] for c in data["top_bug_categories_last_30d"]}
    assert "sql_injection" in cats
    assert cats["sql_injection"] == 2

    # Signatures: ins-common hash repeated twice → count=2; ins-other → count=1
    assert len(data["top_signatures_last_30d"]) == 2
    top_sig = data["top_signatures_last_30d"][0]
    assert top_sig["signature_hash"] == _make_hash("ins-common")
    assert top_sig["count"] == 2

    # Member activity: owner has 2 results, member has 1
    assert len(data["member_activity_last_30d"]) == 2
    counts = sorted(m["results_count"] for m in data["member_activity_last_30d"])
    assert counts == [1, 2]
    # Ranked descending: first entry is the owner with 2 results
    assert data["member_activity_last_30d"][0]["results_count"] == 2

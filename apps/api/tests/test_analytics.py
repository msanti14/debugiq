"""Tests for analytics events endpoint: POST /v0/analytics/events"""

# Valid 64-character lowercase SHA-256 hex strings for use in tests.
_HASH_A = "a" * 64
_HASH_B = "b" * 64


# ── Helpers ───────────────────────────────────────────────────────────────────


def _register_and_login(client, email: str, password: str = "securepass123") -> str:
    """Register a user and return a valid access token."""
    client.post(
        "/v0/auth/register",
        json={"email": email, "password": password},
    )
    res = client.post(
        "/v0/auth/login",
        json={"email": email, "password": password},
    )
    return res.json()["access_token"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Success cases ─────────────────────────────────────────────────────────────


def test_post_analytics_event_signature_generated(client):
    token = _register_and_login(client, "analytics1@example.com")
    res = client.post(
        "/v0/analytics/events",
        json={
            "event_type": "signature_generated",
            "properties": {
                "signature_hash": _HASH_A,
                "status": "new",
                "severity_summary": "high",
                "mode": "quick",
                "language": "python",
                "repo_key_hash": _HASH_B,
            },
        },
        headers=_auth_headers(token),
    )
    assert res.status_code == 201
    data = res.json()
    assert "event_id" in data
    assert len(data["event_id"]) > 0


def test_post_analytics_event_signature_repeated(client):
    token = _register_and_login(client, "analytics2@example.com")
    res = client.post(
        "/v0/analytics/events",
        json={
            "event_type": "signature_repeated",
            "properties": {"signature_hash": _HASH_A, "status": "repeated"},
        },
        headers=_auth_headers(token),
    )
    assert res.status_code == 201


def test_post_analytics_event_hook_installed(client):
    token = _register_and_login(client, "analytics3@example.com")
    res = client.post(
        "/v0/analytics/events",
        json={"event_type": "hook_installed", "properties": {}},
        headers=_auth_headers(token),
    )
    assert res.status_code == 201


def test_post_analytics_event_hook_warning_shown(client):
    token = _register_and_login(client, "analytics4@example.com")
    res = client.post(
        "/v0/analytics/events",
        json={"event_type": "hook_warning_shown", "properties": {"signature_hash": _HASH_A}},
        headers=_auth_headers(token),
    )
    assert res.status_code == 201


def test_post_analytics_event_empty_properties_is_valid(client):
    """properties field is optional — empty dict should be accepted."""
    token = _register_and_login(client, "analytics5@example.com")
    res = client.post(
        "/v0/analytics/events",
        json={"event_type": "hook_installed", "properties": {}},
        headers=_auth_headers(token),
    )
    assert res.status_code == 201


# ── Auth validation ───────────────────────────────────────────────────────────


def test_post_analytics_event_requires_auth(client):
    """Unauthenticated requests must be rejected with 401 or 403."""
    res = client.post(
        "/v0/analytics/events",
        json={"event_type": "hook_installed", "properties": {}},
    )
    assert res.status_code in (401, 403)


def test_post_analytics_event_bad_token_rejected(client):
    """A bogus bearer token must be rejected."""
    res = client.post(
        "/v0/analytics/events",
        json={"event_type": "hook_installed", "properties": {}},
        headers={"Authorization": "Bearer totally.invalid.token"},
    )
    assert res.status_code in (401, 403)


# ── Schema validation ─────────────────────────────────────────────────────────


def test_post_analytics_event_unknown_type_rejected(client):
    """An unknown event_type must return 422."""
    token = _register_and_login(client, "analytics6@example.com")
    res = client.post(
        "/v0/analytics/events",
        json={"event_type": "not_a_real_event", "properties": {}},
        headers=_auth_headers(token),
    )
    assert res.status_code == 422


def test_post_analytics_event_missing_event_type_rejected(client):
    """Missing event_type field must return 422."""
    token = _register_and_login(client, "analytics7@example.com")
    res = client.post(
        "/v0/analytics/events",
        json={"properties": {}},
        headers=_auth_headers(token),
    )
    assert res.status_code == 422


def test_post_analytics_event_invalid_signature_hash_rejected(client):
    """signature_hash that is not a 64-char SHA-256 hex string must return 422."""
    token = _register_and_login(client, "analyticsA@example.com")
    for bad_hash in ["abc123", "not-a-hash", "g" * 64, "A" * 64, _HASH_A[:-1]]:
        res = client.post(
            "/v0/analytics/events",
            json={
                "event_type": "signature_generated",
                "properties": {"signature_hash": bad_hash},
            },
            headers=_auth_headers(token),
        )
        assert res.status_code == 422, f"expected 422 for hash {bad_hash!r}, got {res.status_code}"


def test_post_analytics_event_invalid_repo_key_hash_rejected(client):
    """repo_key_hash that is not a 64-char SHA-256 hex string must return 422."""
    token = _register_and_login(client, "analyticsB@example.com")
    res = client.post(
        "/v0/analytics/events",
        json={
            "event_type": "signature_generated",
            "properties": {"repo_key_hash": "short"},
        },
        headers=_auth_headers(token),
    )
    assert res.status_code == 422


def test_post_analytics_event_unexpected_property_rejected(client):
    """Extra/unknown fields in properties must return 422 (schema is closed)."""
    token = _register_and_login(client, "analyticsC@example.com")
    res = client.post(
        "/v0/analytics/events",
        json={
            "event_type": "hook_installed",
            "properties": {"arbitrary_key": "some_value"},
        },
        headers=_auth_headers(token),
    )
    assert res.status_code == 422


def test_post_analytics_event_invalid_severity_rejected(client):
    """An invalid severity_summary enum value must return 422."""
    token = _register_and_login(client, "analyticsD@example.com")
    res = client.post(
        "/v0/analytics/events",
        json={
            "event_type": "signature_generated",
            "properties": {"severity_summary": "extreme"},
        },
        headers=_auth_headers(token),
    )
    assert res.status_code == 422


def test_post_analytics_event_invalid_mode_rejected(client):
    """An invalid mode enum value must return 422."""
    token = _register_and_login(client, "analyticsE@example.com")
    res = client.post(
        "/v0/analytics/events",
        json={
            "event_type": "signature_generated",
            "properties": {"mode": "turbo"},
        },
        headers=_auth_headers(token),
    )
    assert res.status_code == 422


def test_post_analytics_event_invalid_language_rejected(client):
    """An invalid language enum value must return 422."""
    token = _register_and_login(client, "analyticsF@example.com")
    res = client.post(
        "/v0/analytics/events",
        json={
            "event_type": "signature_generated",
            "properties": {"language": "cobol"},
        },
        headers=_auth_headers(token),
    )
    assert res.status_code == 422


def test_post_analytics_event_invalid_status_rejected(client):
    """An invalid status enum value must return 422."""
    token = _register_and_login(client, "analyticsG@example.com")
    res = client.post(
        "/v0/analytics/events",
        json={
            "event_type": "signature_generated",
            "properties": {"status": "unknown"},
        },
        headers=_auth_headers(token),
    )
    assert res.status_code == 422


# ── Persistence ───────────────────────────────────────────────────────────────


def test_post_analytics_event_persisted(client, db_session):
    """Verify the event is actually written to the database."""
    from src.db.models import AnalyticsEvent

    token = _register_and_login(client, "analytics8@example.com")
    res = client.post(
        "/v0/analytics/events",
        json={
            "event_type": "signature_generated",
            "properties": {"signature_hash": _HASH_A},
        },
        headers=_auth_headers(token),
    )
    assert res.status_code == 201
    event_id = res.json()["event_id"]

    import uuid

    stored = (
        db_session.query(AnalyticsEvent).filter(AnalyticsEvent.id == uuid.UUID(event_id)).first()
    )
    assert stored is not None
    assert stored.event_type == "signature_generated"
    assert stored.properties["signature_hash"] == _HASH_A
    assert stored.user_id is not None


# ── team_insights_selector_changed ────────────────────────────────────────────


def test_post_analytics_event_team_insights_selector_changed_accepted(client):
    """team_insights_selector_changed event type with days and top_n is accepted."""
    token = _register_and_login(client, "analyticsH@example.com")
    res = client.post(
        "/v0/analytics/events",
        json={
            "event_type": "team_insights_selector_changed",
            "properties": {"days": 30, "top_n": 10},
        },
        headers=_auth_headers(token),
    )
    assert res.status_code == 201
    assert "event_id" in res.json()


def test_post_analytics_event_days_property_accepted(client):
    """days integer property is accepted on team_insights_selector_changed."""
    token = _register_and_login(client, "analyticsI@example.com")
    res = client.post(
        "/v0/analytics/events",
        json={
            "event_type": "team_insights_selector_changed",
            "properties": {"days": 7},
        },
        headers=_auth_headers(token),
    )
    assert res.status_code == 201


def test_post_analytics_event_top_n_property_accepted(client):
    """top_n integer property is accepted on team_insights_selector_changed."""
    token = _register_and_login(client, "analyticsJ@example.com")
    res = client.post(
        "/v0/analytics/events",
        json={
            "event_type": "team_insights_selector_changed",
            "properties": {"top_n": 50},
        },
        headers=_auth_headers(token),
    )
    assert res.status_code == 201


def test_post_analytics_event_days_top_n_unknown_keys_still_rejected(client):
    """Schema remains closed: arbitrary unknown keys alongside days/top_n are rejected."""
    token = _register_and_login(client, "analyticsK@example.com")
    res = client.post(
        "/v0/analytics/events",
        json={
            "event_type": "team_insights_selector_changed",
            "properties": {"days": 30, "top_n": 10, "unknown_field": "value"},
        },
        headers=_auth_headers(token),
    )
    assert res.status_code == 422

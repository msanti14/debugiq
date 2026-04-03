"""Tests for analytics events endpoint: POST /v0/analytics/events"""


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
                "signature_hash": "abc123",
                "status": "new",
                "severity_summary": "high",
                "mode": "quick",
                "language": "python",
                "repo_key_hash": "def456",
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
            "properties": {"signature_hash": "abc123", "status": "repeated"},
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
        json={"event_type": "hook_warning_shown", "properties": {"signature_hash": "xyz"}},
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


# ── Persistence ───────────────────────────────────────────────────────────────


def test_post_analytics_event_persisted(client, db_session):
    """Verify the event is actually written to the database."""
    from src.db.models import AnalyticsEvent

    token = _register_and_login(client, "analytics8@example.com")
    res = client.post(
        "/v0/analytics/events",
        json={
            "event_type": "signature_generated",
            "properties": {"signature_hash": "persist_test"},
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
    assert stored.properties["signature_hash"] == "persist_test"
    assert stored.user_id is not None

"""Tests for /health endpoint."""


def test_health_returns_ok(client):
    res = client.get("/health")
    # DB is connected (SQLite in-memory) so status should be ok
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "version" in data

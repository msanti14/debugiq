"""Tests for auth endpoints: register, login, refresh, logout."""



def test_register_success(client):
    res = client.post(
        "/v0/auth/register",
        json={
            "email": "test@example.com",
            "password": "securepass123",
            "display_name": "Test User",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == "test@example.com"
    assert "user_id" in data


def test_register_duplicate_email(client):
    payload = {"email": "dup@example.com", "password": "securepass123"}
    client.post("/v0/auth/register", json=payload)
    res = client.post("/v0/auth/register", json=payload)
    assert res.status_code == 409
    assert res.json()["detail"] == "email_already_registered"


def test_register_password_too_short(client):
    res = client.post(
        "/v0/auth/register",
        json={
            "email": "short@example.com",
            "password": "abc",
        },
    )
    assert res.status_code == 422


def test_login_success(client):
    client.post(
        "/v0/auth/register",
        json={
            "email": "login@example.com",
            "password": "securepass123",
        },
    )
    res = client.post(
        "/v0/auth/login",
        json={
            "email": "login@example.com",
            "password": "securepass123",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] == 900


def test_login_wrong_password(client):
    client.post(
        "/v0/auth/register",
        json={
            "email": "wrongpw@example.com",
            "password": "securepass123",
        },
    )
    res = client.post(
        "/v0/auth/login",
        json={
            "email": "wrongpw@example.com",
            "password": "wrongpassword",
        },
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "invalid_credentials"


def test_login_unknown_email(client):
    res = client.post(
        "/v0/auth/login",
        json={
            "email": "nobody@example.com",
            "password": "securepass123",
        },
    )
    assert res.status_code == 401


def test_refresh_rotates_token(client):
    client.post(
        "/v0/auth/register",
        json={
            "email": "refresh@example.com",
            "password": "securepass123",
        },
    )
    login_res = client.post(
        "/v0/auth/login",
        json={
            "email": "refresh@example.com",
            "password": "securepass123",
        },
    )
    original_refresh = login_res.json()["refresh_token"]

    refresh_res = client.post("/v0/auth/refresh", json={"refresh_token": original_refresh})
    assert refresh_res.status_code == 200
    new_data = refresh_res.json()
    assert "access_token" in new_data
    # New refresh token must differ from the original (rotation)
    assert new_data["refresh_token"] != original_refresh


def test_refresh_old_token_rejected_after_rotation(client):
    """Once rotated, the old refresh token must not be accepted again."""
    client.post(
        "/v0/auth/register",
        json={
            "email": "revoke@example.com",
            "password": "securepass123",
        },
    )
    login_res = client.post(
        "/v0/auth/login",
        json={
            "email": "revoke@example.com",
            "password": "securepass123",
        },
    )
    original_refresh = login_res.json()["refresh_token"]

    # First use: ok
    client.post("/v0/auth/refresh", json={"refresh_token": original_refresh})

    # Second use of same token: must be rejected
    res = client.post("/v0/auth/refresh", json={"refresh_token": original_refresh})
    assert res.status_code == 401


def test_logout_clears_refresh_token(client):
    client.post(
        "/v0/auth/register",
        json={
            "email": "logout@example.com",
            "password": "securepass123",
        },
    )
    login_res = client.post(
        "/v0/auth/login",
        json={
            "email": "logout@example.com",
            "password": "securepass123",
        },
    )
    tokens = login_res.json()

    res = client.post(
        "/v0/auth/logout",
        json={"refresh_token": tokens["refresh_token"]},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert res.status_code == 204

    # Refresh with the now-revoked token must fail
    res2 = client.post("/v0/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert res2.status_code == 401

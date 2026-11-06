import pytest
from app.models.user import User
from app.api.routes.auth import get_password_hash

def test_webauthn_status_has_passkey(client, db_session):
    from app.models.webauthn_credential import WebAuthnCredential
    user = User(email="passkey@test.com", hashed_password=get_password_hash("pw"))
    cred = WebAuthnCredential(credential_id="123", public_key="abc", sign_count=0)
    user.webauthn_credentials.append(cred)
    db_session.add(user)
    db_session.commit()

    res = client.get("/api/v1/auth/webauthn/status/passkey@test.com")
    assert res.status_code == 200
    assert res.json()["has_passkey"] is True

def test_webauthn_status_no_passkey(client, db_session):
    user = User(email="nopasskey@test.com", hashed_password=get_password_hash("pw"))
    db_session.add(user)
    db_session.commit()

    res = client.get("/api/v1/auth/webauthn/status/nopasskey@test.com")
    assert res.status_code == 200
    assert res.json()["has_passkey"] is False

def test_webauthn_status_not_found(client):
    res = client.get("/api/v1/auth/webauthn/status/nobody@test.com")
    assert res.status_code == 200
    assert res.json()["has_passkey"] is False

def test_webauthn_login_begin_no_passkey(client, db_session):
    user = User(email="nopasskey@test.com", hashed_password=get_password_hash("pw"))
    db_session.add(user)
    db_session.commit()

    res = client.post("/api/v1/auth/webauthn/login/begin", json={"email": "nopasskey@test.com"})
    assert res.status_code == 404
    assert "no hay passkey registrado" in res.json()["detail"].lower()

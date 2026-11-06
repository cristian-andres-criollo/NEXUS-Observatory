import pytest
from app.models.user import User
from app.api.routes.auth import get_password_hash

def test_register_user_success(client, db_session):
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "newuser@test.com", "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Usuario registrado exitosamente"
    assert data["email"] == "newuser@test.com"
    
    # Check if user is in DB
    user = db_session.query(User).filter(User.email == "newuser@test.com").first()
    assert user is not None

def test_register_existing_user(client, db_session):
    # Register once
    client.post("/api/v1/auth/register", json={"email": "exist@test.com", "password": "pw"})
    # Try again
    response = client.post("/api/v1/auth/register", json={"email": "exist@test.com", "password": "pw"})
    assert response.status_code == 400
    assert "ya está registrado" in response.json()["detail"]

def test_login_success(client, db_session):
    user = User(email="login@test.com", hashed_password=get_password_hash("password123"), role="admin", plan="enterprise")
    db_session.add(user)
    db_session.commit()

    response = client.post(
        "/api/v1/auth/login",
        data={"username": "login@test.com", "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["email"] == "login@test.com"

def test_login_failure(client, db_session):
    user = User(email="loginfail@test.com", hashed_password=get_password_hash("password123"), role="admin")
    db_session.add(user)
    db_session.commit()

    response = client.post(
        "/api/v1/auth/login",
        data={"username": "loginfail@test.com", "password": "wrongpassword"}
    )
    assert response.status_code == 401
    assert "incorrectos" in response.json()["detail"].lower()

def test_update_profile(client, db_session):
    user = User(email="profile@test.com", hashed_password=get_password_hash("password123"), role="admin")
    db_session.add(user)
    db_session.commit()

    # Get token
    login_res = client.post("/api/v1/auth/login", data={"username": "profile@test.com", "password": "password123"})
    token = login_res.json()["access_token"]

    response = client.put(
        "/api/v1/auth/me/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "full_name": "Nexus Tester",
            "language": "en"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Nexus Tester"
    assert data["language"] == "en"

    # Verify DB
    db_session.refresh(user)
    assert user.full_name == "Nexus Tester"
    assert user.language == "en"

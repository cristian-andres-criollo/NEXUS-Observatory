import pytest
from unittest.mock import patch
from app.models.user import User
from app.api.routes.auth import get_password_hash

def test_metrics_unauthorized(client):
    response = client.get("/api/v1/metrics/")
    assert response.status_code == 401

@patch("app.api.routes.metrics.get_global_metrics")
def test_metrics_authorized_admin(mock_get_metrics, client, db_session):
    mock_get_metrics.return_value = {
        "total_conversations": 10,
        "total_tokens": 100, 
        "total_cost_usd": 0.5, 
        "active_users": 1, 
        "avg_latency_ms": 150,
        "avg_hallucination_score": 0.0,
        "conversations_by_module": {},
        "recent_conversations": []
    }
    
    user = User(email="admin@test.com", hashed_password=get_password_hash("pw"), role="admin", plan="enterprise")
    db_session.add(user)
    db_session.commit()
    
    login_res = client.post("/api/v1/auth/login", data={"username": "admin@test.com", "password": "pw"})
    token = login_res.json()["access_token"]
    
    response = client.get("/api/v1/metrics/", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    # Cada cuenta (aunque sea admin) solo ve lo suyo: sus conversaciones + sus agentes
    mock_get_metrics.assert_called_once_with(db_session, "admin@test.com", None, [])

@patch("app.api.routes.metrics.get_global_metrics")
def test_metrics_authorized_user_forces_personal(mock_get_metrics, client, db_session):
    mock_get_metrics.return_value = {
        "total_conversations": 10,
        "total_tokens": 100, 
        "total_cost_usd": 0.5, 
        "active_users": 1, 
        "avg_latency_ms": 150,
        "avg_hallucination_score": 0.0,
        "conversations_by_module": {},
        "recent_conversations": []
    }
    
    user = User(email="user@test.com", hashed_password=get_password_hash("pw"), role="user", plan="community")
    db_session.add(user)
    db_session.commit()
    
    login_res = client.post("/api/v1/auth/login", data={"username": "user@test.com", "password": "pw"})
    token = login_res.json()["access_token"]
    
    # Even if they request global (personal=False), the route forces personal=True because role != admin
    response = client.get("/api/v1/metrics/", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    mock_get_metrics.assert_called_once_with(db_session, "user@test.com", None, [])

@patch("app.api.routes.metrics.get_latency_history")
def test_latency_history(mock_get_latency, client, db_session):
    mock_get_latency.return_value = [{"timestamp": "2026-01-01", "latency_ms": 200}]
    
    user = User(email="admin@test.com", hashed_password=get_password_hash("pw"), role="admin")
    db_session.add(user)
    db_session.commit()
    
    login_res = client.post("/api/v1/auth/login", data={"username": "admin@test.com", "password": "pw"})
    token = login_res.json()["access_token"]
    
    response = client.get("/api/v1/metrics/latency", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == [{"timestamp": "2026-01-01", "latency_ms": 200}]

@patch("app.api.routes.metrics.get_cost_history")
def test_cost_history(mock_get_cost, client, db_session):
    mock_get_cost.return_value = [{"timestamp": "2026-01-01", "cost_usd": 0.5}]
    
    user = User(email="admin@test.com", hashed_password=get_password_hash("pw"), role="admin")
    db_session.add(user)
    db_session.commit()
    
    login_res = client.post("/api/v1/auth/login", data={"username": "admin@test.com", "password": "pw"})
    token = login_res.json()["access_token"]
    
    response = client.get("/api/v1/metrics/cost", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == [{"timestamp": "2026-01-01", "cost_usd": 0.5}]

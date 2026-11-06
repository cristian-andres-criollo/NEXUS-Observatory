import pytest
from app.models.user import User
from app.models.external_project import ExternalProject
from app.api.routes.auth import get_password_hash

@pytest.fixture
def admin_token(client, db_session):
    user = User(email="superadmin@test.com", hashed_password=get_password_hash("pw"), role="admin", plan="enterprise")
    db_session.add(user)
    db_session.commit()
    
    login_res = client.post("/api/v1/auth/login", data={"username": "superadmin@test.com", "password": "pw"})
    return login_res.json()["access_token"]

@pytest.fixture
def non_admin_token(client, db_session):
    user = User(email="normal@test.com", hashed_password=get_password_hash("pw"), role="user", plan="community")
    db_session.add(user)
    db_session.commit()
    
    login_res = client.post("/api/v1/auth/login", data={"username": "normal@test.com", "password": "pw"})
    return login_res.json()["access_token"]

def test_get_dashboard_as_admin(client, admin_token):
    res = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "budget_cop" in data
    assert "total_tokens_purchased" in data
    assert "users" in data
    assert "projects" in data

def test_get_dashboard_as_non_admin(client, non_admin_token):
    res = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {non_admin_token}"})
    assert res.status_code == 403

def test_create_project(client, admin_token, db_session):
    payload = {
        "name": "Test Project API",
        "description": "Integration Test",
        "owner_email": "owner@test.com",
        "plan": "free",
        "budget_cop": 100000.0,
        "functions": "",
        "llm_provider": "groq"
    }
    res = client.post("/api/v1/admin/projects", headers={"Authorization": f"Bearer {admin_token}"}, json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["message"] == "Proyecto creado exitosamente"
    assert "api_key" in data
    
    # Verify in DB
    project = db_session.query(ExternalProject).filter(ExternalProject.name == "Test Project API").first()
    assert project is not None
    assert project.budget_cop == 100000.0

def test_list_projects(client, admin_token, db_session):
    res = client.get("/api/v1/admin/projects", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_update_budget(client, admin_token):
    payload = {
        "budget_cop": 2000000,
        "trm_usd_cop": 4000.0,
        "groq_cost_per_million": 0.5
    }
    res = client.put("/api/v1/admin/budget", headers={"Authorization": f"Bearer {admin_token}"}, json=payload)
    assert res.status_code == 200
    assert res.json()["message"] == "Presupuesto actualizado"
    
    # Fetch dashboard to verify
    dash = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {admin_token}"}).json()
    assert dash["budget_cop"] == 2000000
    assert dash["trm_usd_cop"] == 4000.0

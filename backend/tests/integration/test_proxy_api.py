import pytest
from app.models.external_project import ExternalProject, generate_api_key, hash_api_key
from app.models.agent_user import AgentUserLimit
from app.models.conversation import Conversation
from app.core.crypto import encrypt_api_key

def test_proxy_unauthorized(client):
    """Prueba que el proxy rechace peticiones sin autenticación válida."""
    response = client.post(
        "/proxy/v1/chat/completions",
        json={"model": "llama-3.1-8b-instant", "messages": []}
    )
    assert response.status_code == 401
    assert "detail" in response.json()

def test_proxy_project_budget_exceeded(client, db_session):
    """Prueba que si el presupuesto global del proyecto se excede, el proxy rechaza la petición."""
    raw_key = generate_api_key()
    
    # Crear proyecto mock
    project = ExternalProject(
        name="Test Project",
        owner_email="admin@test.com",
        api_key_hash=hash_api_key(raw_key),
        api_key_prefix=raw_key[:12],
        budget_cop=100.0,
        spent_cop=150.0,  # Gasto > Presupuesto
        budget_month="2026-08", # avoid reset
        llm_api_key=encrypt_api_key("dummy_key")
    )
    db_session.add(project)
    db_session.commit()

    response = client.post(
        "/proxy/v1/chat/completions",
        headers={"Authorization": f"Bearer {raw_key}"},
        json={"model": "llama-3.1-8b-instant", "messages": [{"role": "user", "content": "Hola"}]}
    )
    
    assert response.status_code == 402
    assert "agotado" in response.json()["detail"].lower()

def test_proxy_user_budget_exceeded(client, db_session):
    """Prueba que si el límite del usuario se excede, el proxy rechaza la petición."""
    raw_key = generate_api_key()
    
    # Crear proyecto mock con presupuesto
    project = ExternalProject(
        name="Test Project",
        owner_email="admin@test.com",
        api_key_hash=hash_api_key(raw_key),
        api_key_prefix=raw_key[:12],
        budget_cop=50000.0,
        spent_cop=0.0,
        budget_month="2026-08",
        llm_api_key=encrypt_api_key("dummy_key")
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    # Crear límite de usuario excedido
    user_limit = AgentUserLimit(
        project_id=project.id,
        user_identifier="user1@test.com",
        budget_cop=50.0,
        spent_cop=60.0 # Gasto > Límite
    )
    db_session.add(user_limit)
    db_session.commit()

    response = client.post(
        "/proxy/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {raw_key}",
            "X-Nexus-End-User-ID": "user1@test.com"
        },
        json={"model": "llama-3.1-8b-instant", "messages": [{"role": "user", "content": "Hola"}]}
    )
    
    assert response.status_code == 403
    assert "límite" in response.json()["detail"].lower()

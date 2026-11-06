import pytest
from app.models.external_project import ExternalProject, generate_api_key, hash_api_key
from app.models.agent_user import AgentUserLimit
from app.models.conversation import Conversation
from app.core.crypto import encrypt_api_key
from datetime import datetime, timezone

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
        budget_month=datetime.now(timezone.utc).strftime("%Y-%m"), # avoid reset
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
        budget_month=datetime.now(timezone.utc).strftime("%Y-%m"),
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


# ── Regresiones: cobro y usuarios finales sin límite individual ────────────────

class _FakeLLMResponse:
    def __init__(self, prompt_tokens, completion_tokens):
        self._data = {
            "id": "fake", "object": "chat.completion", "model": "openai/gpt-oss-20b",
            "choices": [{"index": 0, "message": {"role": "assistant", "content": "hola"}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": prompt_tokens, "completion_tokens": completion_tokens,
                      "total_tokens": prompt_tokens + completion_tokens},
        }

    def model_dump(self):
        return self._data


def _make_project(db_session, budget=50000.0, provider="groq"):
    raw_key = generate_api_key()
    project = ExternalProject(
        name="Proyecto Cobro", owner_email="admin@test.com",
        api_key_hash=hash_api_key(raw_key), api_key_prefix=raw_key[:12],
        budget_cop=budget, spent_cop=0.0, llm_provider=provider,
        budget_month=datetime.now(timezone.utc).strftime("%Y-%m"),
        llm_api_key=encrypt_api_key("dummy_key"),
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project, raw_key


@pytest.fixture
def fake_llm(monkeypatch):
    calls = []

    async def _fake_acompletion(**kwargs):
        calls.append(kwargs)
        return _FakeLLMResponse(100, 50)

    monkeypatch.setattr("app.api.routes.proxy.litellm.acompletion", _fake_acompletion)
    return calls


def test_proxy_cobra_tokens_con_tarifa_del_proveedor(client, db_session, fake_llm):
    """Un modelo 'openai/gpt-oss-20b' servido por Groq se cobra a tarifa Groq (0.69 USD/M), no OpenAI."""
    project, raw_key = _make_project(db_session)
    r = client.post("/proxy/v1/chat/completions", headers={"Authorization": f"Bearer {raw_key}"},
                    json={"model": "openai/gpt-oss-20b", "messages": [{"role": "user", "content": "Hola"}]})
    assert r.status_code == 200
    db_session.refresh(project)
    esperado = 150 / 1_000_000 * 0.69 * 4200.0  # tokens * USD/M * TRM por defecto
    assert project.spent_cop == pytest.approx(esperado)
    assert fake_llm[0]["model"] == "groq/openai/gpt-oss-20b"


def test_proxy_usuario_final_sin_limite_varias_llamadas(client, db_session, fake_llm):
    """Un usuario final nuevo (sin presupuesto individual) puede hacer varias llamadas y se le acumula el gasto."""
    project, raw_key = _make_project(db_session)
    headers = {"Authorization": f"Bearer {raw_key}", "X-Nexus-End-User-ID": "cliente_nuevo"}
    body = {"model": "openai/gpt-oss-20b", "messages": [{"role": "user", "content": "Hola"}]}
    assert client.post("/proxy/v1/chat/completions", headers=headers, json=body).status_code == 200
    assert client.post("/proxy/v1/chat/completions", headers=headers, json=body).status_code == 200
    limite = db_session.query(AgentUserLimit).filter_by(project_id=project.id, user_identifier="cliente_nuevo").one()
    assert limite.budget_cop is None
    assert limite.spent_cop == pytest.approx(2 * 150 / 1_000_000 * 0.69 * 4200.0)


def test_proxy_recorta_max_tokens_al_saldo(client, db_session, fake_llm):
    """Si el saldo solo alcanza para pocos tokens, Nexus baja max_tokens antes de llamar a la IA."""
    costo_token = 0.69 / 1_000_000 * 4200.0
    project, raw_key = _make_project(db_session, budget=200 * costo_token)
    r = client.post("/proxy/v1/chat/completions", headers={"Authorization": f"Bearer {raw_key}"},
                    json={"model": "openai/gpt-oss-20b", "max_tokens": 1000,
                          "messages": [{"role": "user", "content": "Hola"}]})
    assert r.status_code == 200
    assert fake_llm[0]["max_tokens"] < 200

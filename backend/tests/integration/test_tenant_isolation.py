"""Cada cuenta solo ve y maneja SUS agentes y SUS métricas (bug: cuentas nuevas veían agentes ajenos)."""
import pytest
from app.models.user import User
from app.models.conversation import Conversation
from app.api.routes.auth import get_password_hash


def _registrar_y_login(client, email):
    assert client.post("/api/v1/auth/register", json={"email": email, "password": "Clave12345*"}).status_code == 200
    r = client.post("/api/v1/auth/login", data={"username": email, "password": "Clave12345*"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def dueno(client):
    return _registrar_y_login(client, "dueno@test.com")


@pytest.fixture
def nueva(client):
    return _registrar_y_login(client, "nueva@test.com")


def _crear_agente(client, headers, nombre):
    r = client.post("/api/v1/admin/projects", headers=headers, json={
        "name": nombre, "owner_email": "x@test.com", "budget_cop": 50000})
    assert r.status_code == 200
    return r.json()["id"]


def test_cuenta_nueva_no_ve_agentes_ajenos(client, dueno, nueva):
    _crear_agente(client, dueno, "Agente del dueño")
    assert client.get("/api/v1/admin/projects", headers=nueva).json() == []
    assert client.get("/api/v1/admin/dashboard", headers=nueva).json()["projects"] == []
    nombres = [p["name"] for p in client.get("/api/v1/admin/projects", headers=dueno).json()]
    assert nombres == ["Agente del dueño"]


def test_cuenta_nueva_no_puede_tocar_agentes_ajenos(client, dueno, nueva):
    pid = _crear_agente(client, dueno, "Agente del dueño")
    body = {"name": "hackeado", "owner_email": "x@test.com", "budget_cop": 1}
    assert client.put(f"/api/v1/admin/projects/{pid}", headers=nueva, json=body).status_code == 404
    assert client.delete(f"/api/v1/admin/projects/{pid}", headers=nueva).status_code == 404
    assert client.delete(f"/api/v1/admin/projects/{pid}/hard", headers=nueva).status_code == 404
    assert client.post(f"/api/v1/admin/projects/{pid}/reset-key", headers=nueva).status_code == 404
    assert client.get(f"/api/v1/admin/projects/{pid}/users", headers=nueva).status_code == 404
    assert client.post(f"/api/v1/admin/projects/{pid}/users", headers=nueva,
                       json={"user_identifier": "u1", "budget_cop": 10}).status_code == 404
    # El agente sigue intacto para su dueño
    p = client.get("/api/v1/admin/projects", headers=dueno).json()[0]
    assert p["name"] == "Agente del dueño" and p["is_active"] is True and p["budget_cop"] == 50000


def test_metricas_separadas_por_cuenta(client, db_session, dueno, nueva):
    pid = _crear_agente(client, dueno, "Agente del dueño")
    db_session.add(Conversation(session_id=f"proxy_{pid}_1", user_email="cliente_final", module="proxy_x",
                                user_message="hola", assistant_message="hola", model="m",
                                tokens_used=100, cost_usd=0.1, latency_ms=10,
                                extra={"project_id": pid, "source": "proxy"}))
    db_session.commit()
    assert client.get("/api/v1/metrics/", headers=dueno).json()["total_tokens"] == 100
    assert client.get("/api/v1/metrics/", headers=nueva).json()["total_tokens"] == 0
    assert client.get(f"/api/v1/metrics/?project_id={pid}", headers=nueva).status_code == 404


def test_usuarios_finales_no_se_mezclan_entre_agentes(client, db_session, dueno):
    a = _crear_agente(client, dueno, "Agente A")
    b = _crear_agente(client, dueno, "Agente B")
    db_session.add(Conversation(session_id=f"proxy_{a}_1", user_email="cliente_de_A", module="proxy_a",
                                user_message="h", assistant_message="h", model="m", tokens_used=1,
                                cost_usd=0.0, latency_ms=1, extra={"project_id": a}))
    db_session.commit()
    usuarios_b = [u["user_identifier"] for u in client.get(f"/api/v1/admin/projects/{b}/users", headers=dueno).json()]
    usuarios_a = [u["user_identifier"] for u in client.get(f"/api/v1/admin/projects/{a}/users", headers=dueno).json()]
    assert "cliente_de_A" in usuarios_a
    assert "cliente_de_A" not in usuarios_b

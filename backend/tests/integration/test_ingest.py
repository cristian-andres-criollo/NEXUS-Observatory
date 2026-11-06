import pytest
from app.models.external_project import ExternalProject, generate_api_key, hash_api_key
from datetime import datetime, timezone

def test_ingest_metrics_success(client, db_session):
    raw_key = generate_api_key()
    project = ExternalProject(
        name="Ingest Test",
        owner_email="test@test.com",
        api_key_hash=hash_api_key(raw_key),
        api_key_prefix=raw_key[:12],
        budget_cop=10000.0,
        spent_cop=0.0,
        budget_month=datetime.now(timezone.utc).strftime("%Y-%m"),
        is_active=True
    )
    db_session.add(project)
    db_session.commit()

    payload = {
        "model": "llama-3.1-8b-instant",
        "tokens_in": 100,
        "tokens_out": 50,
        "latency_ms": 500,
        "module": "test_ingest"
    }
    
    res = client.post("/api/v1/ingest", headers={"X-Nexus-Key": raw_key}, json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["project"] == "Ingest Test"
    assert data["tokens_total"] == 150
    assert "cost_usd" in data
    assert "cost_cop" in data

def test_ingest_metrics_budget_exceeded(client, db_session):
    raw_key = generate_api_key()
    project = ExternalProject(
        name="Ingest Exceeded",
        owner_email="test@test.com",
        api_key_hash=hash_api_key(raw_key),
        api_key_prefix=raw_key[:12],
        budget_cop=1000.0,
        spent_cop=1500.0,  # Exceeded
        budget_month=datetime.now(timezone.utc).strftime("%Y-%m"),
        is_active=True
    )
    db_session.add(project)
    db_session.commit()

    payload = {
        "model": "llama-3.1-8b-instant",
        "tokens_in": 100,
        "tokens_out": 50
    }
    
    res = client.post("/api/v1/ingest", headers={"X-Nexus-Key": raw_key}, json=payload)
    assert res.status_code == 402
    assert "agotado" in res.json()["detail"].lower()

def test_ingest_metrics_invalid_key(client):
    payload = {
        "model": "llama-3.1-8b-instant",
        "tokens_in": 100,
        "tokens_out": 50
    }
    
    res = client.post("/api/v1/ingest", headers={"X-Nexus-Key": "invalid_key"}, json=payload)
    assert res.status_code == 401
    assert "inválida" in res.json()["detail"].lower()

def test_ingest_metrics_inactive_project(client, db_session):
    raw_key = generate_api_key()
    project = ExternalProject(
        name="Inactive Project",
        owner_email="test@test.com",
        api_key_hash=hash_api_key(raw_key),
        api_key_prefix=raw_key[:12],
        budget_cop=1000.0,
        spent_cop=0.0,
        budget_month=datetime.now(timezone.utc).strftime("%Y-%m"),
        is_active=False # INACTIVE
    )
    db_session.add(project)
    db_session.commit()

    payload = {
        "model": "llama-3.1-8b-instant"
    }
    
    res = client.post("/api/v1/ingest", headers={"X-Nexus-Key": raw_key}, json=payload)
    assert res.status_code == 403
    assert "desactivado" in res.json()["detail"].lower()

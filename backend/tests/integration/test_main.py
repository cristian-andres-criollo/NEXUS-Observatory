from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_root_api_info():
    response = client.get("/api")
    assert response.status_code == 200
    data = response.json()
    assert "app" in data
    assert data["app"] == "NEXUS Observatory Standalone"
    assert "status" in data
    assert data["status"] == "operational"

def test_security_headers_present():
    response = client.get("/health")
    assert "x-frame-options" in response.headers
    assert response.headers["x-frame-options"] == "DENY"
    assert "x-content-type-options" in response.headers
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "strict-transport-security" in response.headers

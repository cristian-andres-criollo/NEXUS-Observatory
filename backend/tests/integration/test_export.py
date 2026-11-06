import pytest
from unittest.mock import patch

def test_export_code_review_markdown(client):
    payload = {
        "review_data": {
            "summary": "Good",
            "issues": [
                {
                    "severity": "warning",
                    "line": 10,
                    "description": "Test issue",
                    "suggestion": "Fix it"
                }
            ],
            "quality_score": 80.0,
            "security_score": 90.0,
            "maintainability_score": 70.0,
            "corrected_code": "print('ok')",
            "tokens_used": 100,
            "cost_usd": 0.01,
            "latency_ms": 200
        }
    }
    
    with patch("app.api.routes.export.export_code_review_markdown") as mock_export:
        mock_export.return_value = "# Markdown Report"
        response = client.post("/api/v1/export/code-review", json=payload)
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/markdown; charset=utf-8"
        assert response.text == "# Markdown Report"

def test_export_code_review_pdf(client):
    payload = {
        "review_data": {
            "summary": "Good",
            "issues": [],
            "quality_score": 80.0,
            "security_score": 90.0,
            "maintainability_score": 70.0,
            "corrected_code": "print('ok')",
            "tokens_used": 100,
            "cost_usd": 0.01,
            "latency_ms": 200
        }
    }
    
    with patch("app.api.routes.export.export_code_review_markdown") as mock_md, \
         patch("app.api.routes.export.export_to_pdf") as mock_pdf:
        mock_md.return_value = "# Markdown"
        mock_pdf.return_value = b"%PDF-1.4"
        
        response = client.post("/api/v1/export/code-review/pdf", json=payload)
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert response.content == b"%PDF-1.4"

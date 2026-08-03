import pytest
from app.models.agent_user import AgentUserLimit
from app.models.external_project import ExternalProject, generate_api_key, hash_api_key

def test_api_key_generation():
    key = generate_api_key()
    assert key.startswith("nexus_")
    assert len(key) == 6 + 32 # 'nexus_' + 32 hex chars

def test_api_key_hashing():
    raw_key = "nexus_1234567890abcdef"
    hashed = hash_api_key(raw_key)
    assert hashed != raw_key
    assert len(hashed) == 64 # SHA-256 is 64 hex chars

def test_agent_user_limit_model():
    limit = AgentUserLimit(
        project_id=1,
        user_identifier="test@example.com",
        budget_cop=1000.0,
        spent_cop=150.5
    )
    assert limit.project_id == 1
    assert limit.user_identifier == "test@example.com"
    assert limit.budget_cop == 1000.0
    assert limit.spent_cop == 150.5

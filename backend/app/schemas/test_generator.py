from pydantic import BaseModel
from typing import Literal, List, Optional


class SecurityIssue(BaseModel):
    severity: str  # critical, high, medium, low
    title: str
    description: str
    line_hint: Optional[str] = ""
    recommendation: Optional[str] = ""


class TestGeneratorRequest(BaseModel):
    code: str
    language: str = "python"
    framework: Literal['pytest', 'jest', 'junit'] = 'pytest'
    session_id: str = 'default'


class TestGeneratorResponse(BaseModel):
    generated_tests: str
    coverage_estimate: float
    test_count: int
    explanation: str
    security_issues: List[SecurityIssue] = []
    tokens_used: int
    cost_usd: float
    latency_ms: int

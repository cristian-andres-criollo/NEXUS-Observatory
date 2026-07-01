from pydantic import BaseModel
from typing import Optional, List


class CodeReviewRequest(BaseModel):
    code: str
    language: str = "python"
    session_id: str = "default"
    temperature: float = 0.1
    max_tokens: int = 2048


class CodeIssue(BaseModel):
    severity: str           # critical | warning | info
    line: Optional[int] = None
    description: str
    suggestion: str


class CodeReviewResponse(BaseModel):
    summary: str
    issues: List[CodeIssue]
    quality_score: float
    security_score: float
    maintainability_score: float
    corrected_code: str
    tokens_used: int
    cost_usd: float
    latency_ms: int


class RepoAnalysisRequest(BaseModel):
    repo_url: str
    session_id: str = "default"


class AgentStep(BaseModel):
    """Paso individual del agente de análisis de repositorios."""
    step: int
    action: str
    status: str             # running | done | error
    input: Optional[str] = None
    output: Optional[str] = None


class RepoAnalysisResponse(BaseModel):
    repo_name: str
    summary: str
    files_analyzed: int
    issues_found: int
    agent_steps: List[AgentStep]   # tipado fuerte en vez de List[dict]
    quality_score: float
    tokens_used: int
    cost_usd: float
    latency_ms: int

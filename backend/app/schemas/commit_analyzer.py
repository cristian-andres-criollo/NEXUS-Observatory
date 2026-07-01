from pydantic import BaseModel, Field
from typing import List


class CommitAnalysis(BaseModel):
    hash: str
    author: str
    date: str
    message: str
    risk_score: float = Field(ge=0.0, le=1.0)
    risk_level: str
    summary: str
    issues: List[str]


class CommitAnalyzeRequest(BaseModel):
    repo_url: str
    n_commits: int = Field(default=5, ge=1, le=50)
    session_id: str = "default"


class CommitAnalyzeResponse(BaseModel):
    repo_url: str
    commits: List[CommitAnalysis]
    average_risk: float = Field(ge=0.0, le=1.0)
    highest_risk: float = Field(ge=0.0, le=1.0)
    tokens_used: int = 0
    cost_usd: float = 0.0
    latency_ms: int

from pydantic import BaseModel


class RepoChatIndexRequest(BaseModel):
    repo_url: str
    session_id: str = 'default'


class RepoChatQueryRequest(BaseModel):
    repo_url: str
    question: str
    session_id: str = 'default'
    top_k: int = 4
    filename_filter: str | None = None


class RepoChatIndexResponse(BaseModel):
    repo_name: str
    collection_name: str
    files_indexed: int
    chunks_indexed: int
    files_list: list[str] = []
    tokens_used: int
    cost_usd: float
    latency_ms: int


class RepoChatQueryResponse(BaseModel):
    repo_name: str
    collection_name: str
    answer: str
    sources: list[str]
    groundedness_score: float
    hallucination_score: float
    relevancy_score: float | None = None
    tokens_used: int
    cost_usd: float
    latency_ms: int

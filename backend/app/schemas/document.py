from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class DocumentOut(BaseModel):
    id: int
    filename: str
    chunk_count: int
    doc_type: Optional[str] = "text"          # nullable en DB — default seguro
    collection_name: str
    user_email: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RAGRequest(BaseModel):
    question: str
    session_id: str = "default"
    collection_name: str = "default"
    top_k: int = 4
    filename_filter: Optional[str] = None


class RAGResponse(BaseModel):
    answer: str
    sources: List[str]
    groundedness_score: float
    hallucination_score: float
    relevancy_score: Optional[float] = None
    tokens_used: int
    cost_usd: float
    latency_ms: int

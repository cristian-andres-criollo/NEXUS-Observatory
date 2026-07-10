from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime


class RecentConversation(BaseModel):
    id: str
    module: str
    user_message: str
    tokens_used: int
    cost_usd: float
    latency_ms: int
    hallucination_score: Optional[float]
    created_at: Optional[str]


class TopUser(BaseModel):
    user_email: str
    conversations: int


class GlobalMetrics(BaseModel):
    total_conversations: int
    total_tokens: int
    total_cost_usd: float
    avg_latency_ms: float
    avg_hallucination_score: Optional[float]
    conversations_by_module: Dict[str, int]
    recent_conversations: List[RecentConversation]
    top_user: Optional[str] = None
    top_user_conversations: Optional[int] = 0
    top_users: Optional[List[TopUser]] = []

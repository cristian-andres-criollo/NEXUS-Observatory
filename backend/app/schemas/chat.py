from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    module: str = "chat"
    temperature: float = 0.1
    max_tokens: int = 2048


class ChatResponse(BaseModel):
    response: str
    session_id: str
    tokens_used: int
    cost_usd: float
    latency_ms: int
    hallucination_score: Optional[float] = None
    groundedness_score: Optional[float] = None
    jailbreak_detected: Optional[bool] = False


class ConversationOut(BaseModel):
    id: int
    session_id: str
    module: str
    user_message: str
    assistant_message: str
    tokens_used: int
    cost_usd: float
    latency_ms: int
    hallucination_score: Optional[float]
    jailbreak_detected: Optional[bool] = False
    created_at: Optional[datetime]

    class Config:
        from_attributes = True

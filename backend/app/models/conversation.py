from sqlalchemy import Column, Integer, String, Text, DateTime, Float, JSON, Boolean
from sqlalchemy.sql import func
from app.db.database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), index=True, nullable=False)
    user_email = Column(String(150), index=True, nullable=True)
    module = Column(String(50), nullable=False)          # chat | rag | code_review | repo_agent
    user_message = Column(Text, nullable=False)
    assistant_message = Column(Text, nullable=False)
    model = Column(String(80), default="")           # Groq model name — set by each service
    tokens_used = Column(Integer, default=0)
    cost_usd = Column(Float, default=0.0)
    latency_ms = Column(Integer, default=0)
    hallucination_score = Column(Float, nullable=True)
    groundedness_score = Column(Float, nullable=True)
    jailbreak_detected = Column(Boolean, default=False)
    extra = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())


from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from sqlalchemy.sql import func
from app.db.database import Base


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, nullable=True, index=True)
    module = Column(String(50), nullable=False)
    evaluator = Column(String(100), nullable=False)       # llm_judge | groundedness | hallucination
    score = Column(Float, nullable=False)
    label = Column(String(50), nullable=True)
    explanation = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

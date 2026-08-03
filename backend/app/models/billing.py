from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from app.db.database import Base

class BillingTransaction(Base):
    __tablename__ = "billing_transactions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("external_projects.id", ondelete="CASCADE"), nullable=False)
    stripe_payment_intent_id = Column(String(255), unique=True, index=True)
    amount_usd = Column(Float, nullable=False)
    amount_cop = Column(Float, nullable=False)
    tokens_purchased = Column(Integer, nullable=True) 
    status = Column(String(50), default="pending") # pending, completed, failed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

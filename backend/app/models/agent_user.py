from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

class AgentUserLimit(Base):
    __tablename__ = "agent_user_limits"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("external_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_identifier = Column(String(255), nullable=False, index=True)
    
    budget_cop = Column(Float, nullable=True)  # Si es null, no tiene límite individual (solo el global del agente)
    spent_cop = Column(Float, default=0.0, nullable=False)
    
    is_active = Column(Boolean, default=True, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relaciones
    project = relationship("ExternalProject", back_populates="user_limits")

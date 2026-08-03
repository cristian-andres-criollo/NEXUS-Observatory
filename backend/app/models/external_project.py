import secrets
import hashlib
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


def generate_api_key() -> str:
    """Genera una API key legible: nexus_<32 chars hex>"""
    return "nexus_" + secrets.token_hex(16)


def hash_api_key(raw_key: str) -> str:
    """Almacena solo el hash SHA-256 de la key, nunca el valor plano."""
    return hashlib.sha256(raw_key.encode()).hexdigest()


class ExternalProject(Base):
    __tablename__ = "external_projects"

    id = Column(Integer, primary_key=True, index=True)

    # Identidad del proyecto
    name = Column(String(100), nullable=False)           # "Luminary", "ChatbotX"
    description = Column(Text, nullable=True)
    owner_email = Column(String(150), nullable=False)    # admin que lo creó

    # API Key (solo guardamos el hash, nunca la key plana)
    api_key_hash = Column(String(64), unique=True, nullable=False, index=True)
    api_key_prefix = Column(String(12), nullable=False)  # primeros chars para identificar ("nexus_a1b2")

    # Plan y presupuesto
    plan = Column(String(20), default="starter")         # "starter" | "team" | "enterprise"
    budget_cop = Column(Float, default=50000.0)          # presupuesto mensual en COP
    spent_cop = Column(Float, default=0.0)               # gasto acumulado mes actual
    budget_month = Column(String(7), default="")         # "2026-07" — mes del gasto actual
    
    # Integración de pagos y Facturación
    stripe_customer_id = Column(String(255), nullable=True)
    billing_transactions = relationship("BillingTransaction", backref="project", cascade="all, delete-orphan")
    # Relación uno-a-muchos con límites de usuarios
    user_limits = relationship("AgentUserLimit", back_populates="project", cascade="all, delete-orphan")

    # Configuración de LLM (Bring Your Own Key)
    llm_provider = Column(String(50), default="groq")
    llm_api_key = Column(String(255), nullable=True) # Encriptado con Fernet

    # Control
    is_active = Column(Boolean, default=True)            # kill switch global
    functions = Column(String, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def has_budget(self) -> bool:
        """Verifica si el proyecto aún tiene presupuesto para el mes actual."""
        now = datetime.now()
        current_month = f"{now.year}-{now.month:02d}"
        
        if self.budget_month != current_month:
            # Es un mes nuevo, asumimos que tiene presupuesto (se reseteará en el middleware)
            return True
            
        return self.spent_cop < self.budget_cop

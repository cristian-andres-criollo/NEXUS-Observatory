from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="user")  # "admin" o "user"
    viewed_context_tabs = Column(String, default="{}") # JSON string of viewed tabs
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # ── Datos de Perfil ──────────────────────────────────────────────────────────
    full_name = Column(String, nullable=True)
    profile_picture = Column(Text, nullable=True)
    custom_ai_instructions = Column(Text, nullable=True)
    language = Column(String, default="es")
    hardware_specs = Column(Text, nullable=True)

    # ── Preferencias Visuales ────────────────────────────────────────────────────
    theme_color = Column(String, default="default")  # Ej: "default", "matrix", "amber"

    # ── Plan de membresía ────────────────────────────────────────────────────────
    plan = Column(String, default="community")  # "community" | "team" | "enterprise"
    created_by_admin = Column(Boolean, default=False)
    # Community: chat ilimitado, 10 análisis RAG/mes, 5 usos repo/mes (Freemium)
    # Team: Múltiples usuarios por workspace, tarifa plana (SaaS)
    # Enterprise: Acceso completo controlado por budget_cop (On-Premise)
    
    # Relación con las credenciales biométricas web (hasta 5)
    webauthn_credentials = relationship("WebAuthnCredential", back_populates="user", cascade="all, delete-orphan")

    @property
    def webauthn_enabled(self):
        return len(self.webauthn_credentials) > 0

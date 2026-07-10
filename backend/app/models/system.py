from sqlalchemy import Column, Integer, String, Float, Boolean
from app.db.database import Base

class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    budget_cop = Column(Integer, default=500000)           # Presupuesto en Pesos Colombianos
    trm_usd_cop = Column(Float, default=4200.0)            # Tasa de cambio COP/USD simulada
    groq_cost_per_million = Column(Float, default=0.69)    # USD por millón de tokens
    anthropic_cost_per_million = Column(Float, default=15.0)
    openai_cost_per_million = Column(Float, default=10.0)
    google_cost_per_million = Column(Float, default=7.0)
    
    # Configuración del Motor de IA
    llm_provider = Column(String, default="groq")          # "groq" o "ollama"
    ollama_base_url = Column(String, default="http://localhost:11434")
    ollama_model = Column(String, default="llama3")

class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id = Column(Integer, primary_key=True, index=True)
    card_holder = Column(String, default="NEXUS Observatory")
    card_type = Column(String, default="VISA")       # VISA, MASTERCARD, AMEX
    bank_name = Column(String, default="Bancolombia")
    last_four = Column(String, default="4242")
    available_balance_cop = Column(Integer, default=2000000)  # Saldo disponible en COP
    is_active = Column(Boolean, default=True)
    color_from = Column(String, default="#0e4aff")   # Gradiente de la tarjeta visual
    color_to = Column(String, default="#00d4ff")

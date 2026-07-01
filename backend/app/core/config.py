from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # ── App ────────────────────────────────────────────────────────────────
    APP_NAME: str = "NEXUS Observatory"
    DEBUG: bool = False
    SECRET_KEY: str = "nexus-observatory-dev-secret-key-must-be-at-least-32-bytes"
    CORS_ORIGINS: str = "http://localhost:5173"

    # ── Groq LLM ───────────────────────────────────────────────────────────
    # Puedes proveer múltiples API keys separadas por comas
    GROQ_API_KEYS: str = ""
    # Mantenemos esto por compatibilidad hacia atrás
    GROQ_API_KEY: str = ""

    # URL base de la API de Groq (compatible con el protocolo OpenAI)
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"

    # Modelo por defecto. Opciones disponibles en Groq:
    #   - "llama-3.1-8b-instant"      → Muy rápido, ideal para chat y evaluaciones
    #   - "llama-3.3-70b-versatile"   → Mejor razonamiento, ideal para code review
    #   - "llama-3.1-70b-versatile"   → Alternativa 70B
    #   - "mixtral-8x7b-32768"        → Contexto largo (32k tokens)
    #   - "gemma2-9b-it"              → Google Gemma 2
    GROQ_MODEL: str = "llama-3.1-8b-instant"

    # Modelo específico para tareas de análisis de código (más potente)
    GROQ_CODE_MODEL: str = "llama-3.3-70b-versatile"

    # Máximo de tokens de salida por solicitud
    GROQ_MAX_TOKENS: int = 8192

    # ── Embeddings (locales, sin API key) ──────────────────────────────────
    # Modelo de sentence-transformers para generar embeddings en el módulo RAG.
    # Groq no ofrece endpoints de embeddings, por eso se usa un modelo local.
    # El modelo se descarga automáticamente (~22 MB) en la primera ejecución.
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # ── Observabilidad (todos opcionales) ──────────────────────────────────

    # LangSmith: https://smith.langchain.com → Settings → API Keys
    LANGCHAIN_API_KEY: str = ""
    LANGCHAIN_TRACING_V2: str = "false"
    LANGCHAIN_PROJECT: str = "nexus-observatory"

    # W&B Weave: https://wandb.ai → Settings → API Keys
    WANDB_API_KEY: str = ""
    WANDB_PROJECT: str = "nexus-observatory"

    # Arize Phoenix (self-hosted)
    PHOENIX_HOST: str = "http://localhost:6006"

    # Helicone (proxy opcional — no usado actualmente con Groq)
    HELICONE_API_KEY: str = ""
    HELICONE_BASE_URL: str = "https://oai.helicone.ai/v1"

    # ── Base de datos ───────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./nexus.db"

    def get_cors_origins(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    def get_groq_keys(self) -> List[str]:
        keys = []
        if self.GROQ_API_KEYS:
            keys.extend([k.strip() for k in self.GROQ_API_KEYS.split(",") if k.strip()])
        if self.GROQ_API_KEY and self.GROQ_API_KEY not in keys:
            keys.append(self.GROQ_API_KEY.strip())
        return keys

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()

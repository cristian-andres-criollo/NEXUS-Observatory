import logging
from pydantic import model_validator
from pydantic_settings import BaseSettings
from typing import List

logger = logging.getLogger(__name__)

# Clave pública de desarrollo: solo se acepta con DEBUG=True.
INSECURE_DEV_SECRET_KEY = "nexus-observatory-dev-secret-key-must-be-at-least-32-bytes"
MIN_SECRET_KEY_LENGTH = 32


class Settings(BaseSettings):
    # ── App ────────────────────────────────────────────────────────────────
    APP_NAME: str = "NEXUS Observatory"
    DEBUG: bool = False
    # Obligatorio en producción. Firma los JWT y deriva la clave Fernet que
    # cifra las API keys de los agentes: si cambia, esas keys ya no se descifran.
    # Generar con: python -c "import secrets; print(secrets.token_urlsafe(48))"
    SECRET_KEY: str = ""
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176"

    # ── Email Notifications ──────────────────────────────────────────────────
    EMAIL_HOST: str = ""
    EMAIL_PORT: int = 587
    EMAIL_USER: str = ""
    EMAIL_PASS: str = ""
    EMAIL_FROM: str = ""

    # ── Groq LLM ───────────────────────────────────────────────────────────
    # Puedes proveer múltiples API keys separadas por comas
    GROQ_API_KEYS: str = ""
    # Mantenemos esto por compatibilidad hacia atrás
    GROQ_API_KEY: str = ""

    # URL base de la API de Groq (compatible con el protocolo OpenAI)
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"

    # Modelo por defecto. Groq retiró los modelos Llama (nov-2026); vigentes:
    #   - "openai/gpt-oss-20b"   → Rápido, ideal para chat y evaluaciones
    #   - "openai/gpt-oss-120b"  → Mejor razonamiento, ideal para code review
    #   - "qwen/qwen3.8-27b"     → Alternativa
    # Lista actual: GET https://api.groq.com/openai/v1/models
    GROQ_MODEL: str = "openai/gpt-oss-20b"

    # Modelo específico para tareas de análisis de código (más potente)
    GROQ_CODE_MODEL: str = "openai/gpt-oss-120b"

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

    # ── Database ─────────────────────────────────────────────────────────────
    # Sin credenciales embebidas: define DATABASE_URL en .env para usar Postgres.
    DATABASE_URL: str = "sqlite:///./nexus.db"

    @model_validator(mode="after")
    def _validate_secret_key(self):
        key = self.SECRET_KEY
        if not key and self.DEBUG:
            logger.warning("SECRET_KEY vacío: usando clave de desarrollo (solo DEBUG=True).")
            self.SECRET_KEY = INSECURE_DEV_SECRET_KEY
            return self
        if not key:
            raise ValueError(
                "SECRET_KEY no está configurado. Defínelo en .env o como variable de entorno "
                "(mínimo 32 caracteres). Genera uno con: "
                "python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )
        if len(key) < MIN_SECRET_KEY_LENGTH:
            raise ValueError(f"SECRET_KEY debe tener al menos {MIN_SECRET_KEY_LENGTH} caracteres.")
        if key == INSECURE_DEV_SECRET_KEY and not self.DEBUG:
            raise ValueError("SECRET_KEY usa la clave pública de desarrollo; no se permite con DEBUG=False.")
        return self

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
        # No volcar los valores del .env (API keys) en los logs si la validación falla
        hide_input_in_errors = True


settings = Settings()

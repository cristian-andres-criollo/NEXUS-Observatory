"""
llm_provider.py — Fábricas centralizadas de clientes de IA para NEXUS Observatory.

Este módulo es el único punto de integración con proveedores externos de IA.
Todos los servicios deben importar desde aquí en lugar de instanciar clientes directamente.

Proveedor principal: Groq (https://console.groq.com)
  - Chat / Completions: API compatible con OpenAI → usamos openai + base_url
  - Embeddings: NO disponible en Groq → se usa sentence-transformers (local)
"""
import logging
import threading
import httpx
from functools import lru_cache
from app.core.config import settings
from app.db.database import SessionLocal
from app.models.system import SystemSettings

logger = logging.getLogger(__name__)

def _get_current_llm_settings():
    db = SessionLocal()
    try:
        s = db.query(SystemSettings).first()
        if not s:
            return "groq", "http://localhost:11434", "llama3"
        return s.llm_provider, s.ollama_base_url, s.ollama_model
    except Exception as e:
        logger.error(f"Error leyendo config de IA: {e}")
        return "groq", "http://localhost:11434", "llama3"
    finally:
        db.close()

# ---------------------------------------------------------------------------
# Administrador de Claves de Groq (Rotación en caso de Rate Limit 429)
# ---------------------------------------------------------------------------

class GroqKeyManager:
    _instance = None
    _lock = threading.Lock()
    keys: list[str] = []
    current_index: int = 0

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(GroqKeyManager, cls).__new__(cls)
                cls._instance.keys = settings.get_groq_keys()
                if not cls._instance.keys:
                    raise RuntimeError("No hay API keys de Groq configuradas (GROQ_API_KEYS).")
                cls._instance.current_index = 0
            return cls._instance

    def get_current_key(self) -> str:
        with self._lock:
            return self.keys[self.current_index]

    def rotate_key(self, failed_key: str):
        with self._lock:
            if self.keys[self.current_index] == failed_key:
                self.current_index = (self.current_index + 1) % len(self.keys)
                logger.warning(f"Rotando a la siguiente API Key de Groq (índice {self.current_index})")

manager = GroqKeyManager()

class KeyRotationTransport(httpx.BaseTransport):
    def __init__(self, underlying_transport: httpx.BaseTransport):
        self.underlying = underlying_transport

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        current_key = manager.get_current_key()
        request.headers["Authorization"] = f"Bearer {current_key}"
        
        # Necesitamos leer el stream si es bytes/json para poder reintentar
        if hasattr(request, "read"):
            request.read()

        response = self.underlying.handle_request(request)
        
        if response.status_code == 429:
            logger.warning("Límite de tokens excedido (429). Intentando rotar la API Key...")
            manager.rotate_key(current_key)
            new_key = manager.get_current_key()
            if new_key != current_key:
                request.headers["Authorization"] = f"Bearer {new_key}"
                response.close()
                return self.underlying.handle_request(request)
                
        return response

class AsyncKeyRotationTransport(httpx.AsyncBaseTransport):
    def __init__(self, underlying_transport: httpx.AsyncBaseTransport):
        self.underlying = underlying_transport

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        current_key = manager.get_current_key()
        request.headers["Authorization"] = f"Bearer {current_key}"
        
        if hasattr(request, "aread"):
            await request.aread()
        elif hasattr(request, "read"):
            request.read()

        response = await self.underlying.handle_async_request(request)
        
        if response.status_code == 429:
            logger.warning("Límite de tokens excedido (429). Intentando rotar la API Key...")
            manager.rotate_key(current_key)
            new_key = manager.get_current_key()
            if new_key != current_key:
                request.headers["Authorization"] = f"Bearer {new_key}"
                await response.aclose()
                return await self.underlying.handle_async_request(request)
                
        return response


# ---------------------------------------------------------------------------
# Cliente HTTP compatible con la API de Groq (interfaz OpenAI)
# ---------------------------------------------------------------------------

def _get_groq_base_url() -> str:
    """
    Retorna la URL base para las llamadas al LLM.
    Si HELICONE_API_KEY está configurada, usa el proxy de Helicone;
    de lo contrario, usa Groq directamente.
    """
    if settings.HELICONE_API_KEY:
        logger.debug("🔭 Helicone activo — usando proxy %s", settings.HELICONE_BASE_URL)
        return settings.HELICONE_BASE_URL
    return settings.GROQ_BASE_URL


def _get_helicone_headers() -> dict:
    """Retorna las cabeceras extras que Helicone necesita para identificar el proyecto."""
    if not settings.HELICONE_API_KEY:
        return {}
    return {
        "Helicone-Auth": f"Bearer {settings.HELICONE_API_KEY}",
        "Helicone-Property-App": "nexus-observatory",
    }


def get_groq_client(user_plan: str = "community") -> "OpenAI":
    # Routes to Groq Cloud for community/team plans, Ollama/local for enterprise.
    from openai import OpenAI

    if user_plan in ["community", "team"]:
        provider = "groq"
        ollama_url = "http://localhost:11434"
        ollama_model = "llama3"
    else:
        provider, ollama_url, ollama_model = _get_current_llm_settings()

    if provider == "ollama":
        # Retorna un cliente apuntando al puerto local de Ollama
        return OpenAI(
            api_key="ollama",  # Dummy key
            base_url=f"{ollama_url.rstrip('/')}/v1",
            max_retries=1
        )

    # Groq (directo) o Helicone (proxy) según configuración
    transport = KeyRotationTransport(httpx.HTTPTransport())
    helicone_headers = _get_helicone_headers()
    client = httpx.Client(
        transport=transport,
        headers=helicone_headers if helicone_headers else {},
    )

    return OpenAI(
        api_key=manager.get_current_key(),
        base_url=_get_groq_base_url(),
        http_client=client,
        max_retries=1
    )


# ---------------------------------------------------------------------------
# LLM de LangChain (ChatOpenAI) apuntando a Groq
# ---------------------------------------------------------------------------

def get_langchain_llm(model: str | None = None, temperature: float = 0.1, max_tokens: int | None = None, user_plan: str = "community"):
    # Returns a ChatOpenAI instance pointing to Groq (community/team) or local Ollama (enterprise).
    from langchain_openai import ChatOpenAI

    if user_plan in ["community", "team"]:
        provider = "groq"
        ollama_url = "http://localhost:11434"
        ollama_model_name = "llama3"
    else:
        provider, ollama_url, ollama_model_name = _get_current_llm_settings()
    
    ollama_model_name = str(ollama_model_name)
    ollama_url = str(ollama_url)

    if provider == "ollama":
        # Si no se solicitó un modelo de código específico, usamos el modelo de Ollama configurado
        selected_model = ollama_model_name if not model or model == settings.GROQ_MODEL else model
        # En caso de que sea el de código (versatile), podemos forzar el de Ollama o dejar que lo intente.
        # Por simplicidad, mapeamos cualquier modelo de Groq al modelo de Ollama local.
        if model == settings.GROQ_CODE_MODEL:
             selected_model = ollama_model_name # Reemplazar con el de Ollama

        logger.debug("Instanciando LangChain LLM → OLLAMA LOCAL | modelo=%s", selected_model)
        return ChatOpenAI(
            model=str(selected_model),
            temperature=temperature,
            api_key="ollama", # Dummy
            base_url=f"{ollama_url.rstrip('/')}/v1",
            max_tokens=max_tokens or settings.GROQ_MAX_TOKENS,
            max_retries=1
        )

    # Groq (directo) o Helicone (proxy) según configuración
    selected_model = str(model or settings.GROQ_MODEL)
    base_url = _get_groq_base_url()
    helicone_headers = _get_helicone_headers()

    logger.debug(
        "Instanciando LangChain LLM → %s | modelo=%s | temperatura=%.2f | base=%s",
        "HELICONE→GROQ" if helicone_headers else "GROQ CLOUD",
        selected_model, temperature, base_url,
    )

    transport = KeyRotationTransport(httpx.HTTPTransport())
    async_transport = AsyncKeyRotationTransport(httpx.AsyncHTTPTransport())

    sync_client = httpx.Client(
        transport=transport,
        headers=helicone_headers if helicone_headers else {},
    )
    async_client = httpx.AsyncClient(
        transport=async_transport,
        headers=helicone_headers if helicone_headers else {},
    )

    return ChatOpenAI(
        model=selected_model,
        temperature=temperature,
        api_key=manager.get_current_key(),
        base_url=base_url,
        max_tokens=max_tokens or settings.GROQ_MAX_TOKENS,
        http_client=sync_client,
        http_async_client=async_client,
        max_retries=1
    )


# ---------------------------------------------------------------------------
# Modelo de Embeddings local (sentence-transformers)
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def get_embeddings_model():
    """
    Carga y cachea el modelo de embeddings `sentence-transformers/all-MiniLM-L6-v2`.

    Groq NO ofrece un endpoint de embeddings, por lo que usamos sentence-transformers
    para generar vectores localmente. El modelo pesa ~22 MB, se descarga la primera
    vez y queda cacheado en disco (~/.cache/huggingface/).

    Características del modelo:
      - Dimensión de embedding: 384
      - Velocidad: ~1000 frases/seg en CPU
      - Calidad: muy buena para búsqueda semántica en español/inglés

    Returns:
        SentenceTransformer: instancia lista para llamar a `.encode(texts)`
    """
    try:
        from sentence_transformers import SentenceTransformer
        model_name = settings.EMBEDDING_MODEL
        logger.info("Cargando modelo de embeddings: %s ...", model_name)
        model = SentenceTransformer(model_name)
        logger.info("✅ Modelo de embeddings '%s' cargado (dim=%d)", model_name, model.get_sentence_embedding_dimension())
        return model
    except ImportError:
        raise RuntimeError(
            "sentence-transformers no está instalado. "
            "Ejecuta: pip install sentence-transformers"
        )
    except Exception as e:
        raise RuntimeError(f"Error cargando modelo de embeddings: {e}")


def encode_texts(texts: list) -> list:
    """
    Genera embeddings para una lista de textos usando el modelo local.

    Args:
        texts: Lista de strings a codificar.

    Returns:
        Lista de listas de floats (cada una es un vector de 384 dimensiones).
    """
    model = get_embeddings_model()
    embeddings = model.encode(texts, show_progress_bar=False, batch_size=32)
    return embeddings.tolist()


def encode_query(text: str) -> list:
    """
    Genera el embedding de una sola consulta/pregunta.

    Args:
        text: La consulta del usuario.

    Returns:
        Lista de floats (vector de 384 dimensiones).
    """
    return encode_texts([text])[0]

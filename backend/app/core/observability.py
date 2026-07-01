"""
observability.py — Inicialización de herramientas de observabilidad para NEXUS Observatory.

Configura de forma opcional las siguientes herramientas:
  - LangSmith  (trazas de LangChain)
  - W&B Weave  (métricas y evaluaciones)
  - Arize Phoenix (OpenTelemetry)

Todas son opcionales: si la API key no está configurada, se omiten sin romper la app.

NOTA: Las fábricas de clientes LLM (get_groq_client, get_langchain_llm, encode_texts, etc.)
fueron movidas a `app/core/llm_provider.py` para una separación limpia de responsabilidades.
Se mantienen aquí re-exportadas para retrocompatibilidad con código existente.
"""
import os
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


def setup_observability():
    """Inicializa todas las herramientas de observabilidad configuradas."""
    _setup_langsmith()
    _setup_weave()
    _setup_phoenix()


def _setup_langsmith():
    """Activa el tracing de LangSmith si LANGCHAIN_API_KEY está configurada."""
    if settings.LANGCHAIN_API_KEY:
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_API_KEY"] = settings.LANGCHAIN_API_KEY
        os.environ["LANGCHAIN_PROJECT"] = settings.LANGCHAIN_PROJECT
        # Configurar uploads en background para no bloquear los requests
        os.environ["LANGCHAIN_CALLBACKS_BACKGROUND"] = "true"
        # Timeout corto para no bloquear si LangSmith no responde
        os.environ["LANGSMITH_TIMEOUT"] = "5"
        logger.info("✅ LangSmith activo — trazas en https://smith.langchain.com (modo background)")
    else:
        os.environ["LANGCHAIN_TRACING_V2"] = "false"
        logger.info("⏭  LangSmith omitido (sin API key)")


def _setup_weave():
    """Activa W&B Weave si WANDB_API_KEY está configurada."""
    if settings.WANDB_API_KEY:
        try:
            import wandb
            import weave
            wandb.login(key=settings.WANDB_API_KEY, relogin=True)
            weave.init(settings.WANDB_PROJECT)
            logger.info("✅ W&B Weave activo — métricas en https://wandb.ai")
        except ImportError:
            logger.warning("⚠️  W&B Weave: librerías no instaladas (wandb / weave). Ejecuta: pip install wandb weave")
        except Exception as e:
            logger.warning(f"⚠️  W&B Weave falló: {e}")
    else:
        logger.info("⏭  W&B Weave omitido (sin API key)")


def _setup_phoenix():
    """
    Activa Arize Phoenix (OpenTelemetry) para instrumentar todas las llamadas
    LangChain. Funciona tanto en localhost (desarrollo) como en servidores remotos.

    Requiere tener Phoenix corriendo:
        python -m phoenix.server.main serve   →  http://localhost:6006
    """
    if not settings.PHOENIX_HOST:
        logger.info("⏭  Arize Phoenix omitido (PHOENIX_HOST no configurado)")
        return

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from openinference.instrumentation.langchain import LangChainInstrumentor

        endpoint = f"{settings.PHOENIX_HOST}/v1/traces"
        provider = TracerProvider()
        provider.add_span_processor(
            BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint))
        )
        trace.set_tracer_provider(provider)
        LangChainInstrumentor().instrument()
        logger.info(f"✅ Arize Phoenix activo — trazas en {settings.PHOENIX_HOST}")
    except ImportError:
        logger.warning(
            "⚠️  Arize Phoenix: librerías no instaladas. Ejecuta:\n"
            "    pip install arize-phoenix openinference-instrumentation-langchain opentelemetry-exporter-otlp"
        )
    except Exception as e:
        logger.warning(f"⚠️  Phoenix falló al conectar con {settings.PHOENIX_HOST}: {e}")


# ---------------------------------------------------------------------------
# Re-exportaciones para retrocompatibilidad
# Las implementaciones reales están en app/core/llm_provider.py
# ---------------------------------------------------------------------------

def get_openai_client():
    """[Retrocompatibilidad] → usar app.core.llm_provider.get_groq_client()"""
    from app.core.llm_provider import get_groq_client
    return get_groq_client()


def get_langchain_llm(model: str = None, temperature: float = 0.1):
    """[Retrocompatibilidad] → usar app.core.llm_provider.get_langchain_llm()"""
    from app.core.llm_provider import get_langchain_llm as _get_llm
    return _get_llm(model=model, temperature=temperature)

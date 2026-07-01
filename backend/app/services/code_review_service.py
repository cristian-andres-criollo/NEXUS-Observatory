"""
code_review_service.py — Servicio de revisión de código con IA para NEXUS Observatory.

Usa el modelo Groq más potente (llama-3.3-70b-versatile) para análisis profundo de código.
Devuelve un JSON estructurado con: summary, issues (severity/description/suggestion)
y scores de calidad, seguridad y mantenibilidad.
"""
import time
import json
import logging
from sqlalchemy.orm import Session
from app.core.llm_provider import get_langchain_llm
from app.core.config import settings
from app.models.conversation import Conversation
from app.models.evaluation import Evaluation

logger = logging.getLogger(__name__)

REVIEW_PROMPT = """Eres un senior software engineer con 10+ años de experiencia en revisión de código.
Analiza el siguiente código {language} de forma exhaustiva.

Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin bloques de código markdown.
Usa exactamente esta estructura:

{{
  "summary": "descripción general del código en 2-3 oraciones técnicas",
  "issues": [
    {{
      "severity": "critical",
      "line": null,
      "description": "descripción técnica del problema",
      "suggestion": "cómo solucionarlo con código si aplica"
    }}
  ],
  "quality_score": 0.7,
  "security_score": 0.5,
  "maintainability_score": 0.6,
  "corrected_code": "código corregido aplicando todas las sugerencias del modelo"
}}

Reglas:
- severity debe ser: "critical", "warning" o "info"
- Los scores van de 0.0 a 1.0
- Detecta: SQL injection, credenciales hardcodeadas, memory leaks, código sin manejo de errores,
  complejidad excesiva, magic numbers, TODOs/FIXMEs, violaciones SOLID, código duplicado
- Si el código está limpio, issues debe ser []

CÓDIGO A REVISAR ({language}):
```
{code}
```"""


def review_code(code: str, language: str, db: Session, user_email: str, session_id: str = "default", temperature: float = 0.1, max_tokens: int = 2048) -> dict:
    """
    Analiza el código enviado y devuelve un reporte estructurado JSON con issues y scores.

    Usa el modelo GROQ_CODE_MODEL (llama-3.3-70b-versatile) para mayor precisión en
    el análisis de seguridad, calidad y mantenibilidad.

    Args:
        code:       Código fuente a revisar.
        language:   Lenguaje de programación (python, javascript, etc.).
        session_id: ID de sesión del usuario.
        db:         Sesión de SQLAlchemy.

    Returns:
        dict con: summary, issues, quality_score, security_score,
                  maintainability_score, tokens_used, cost_usd, latency_ms
    """
    start = time.time()
    # Usar el modelo de código especializado con la temperatura solicitada
    llm = get_langchain_llm(model=settings.GROQ_CODE_MODEL, temperature=temperature, max_tokens=max_tokens)

    from langchain_core.messages import HumanMessage, SystemMessage
    prompt = REVIEW_PROMPT.format(language=language, code=code[:4000])

    try:
        response = llm.invoke([
            SystemMessage(content="Eres un experto en revisión de código. Responde SIEMPRE con JSON válido y nada más."),
            HumanMessage(content=prompt),
        ])
    except Exception as e:
        raise RuntimeError(f"Error LLM: {e}")

    latency_ms = int((time.time() - start) * 1000)
    tokens_in, tokens_out = _extract_tokens(response)
    tokens = tokens_in + tokens_out
    # Calcular costo con tarifas reales de Groq para el modelo de code review
    from app.services.chat_service import GROQ_COST_PER_MILLION_TOKENS
    rates = GROQ_COST_PER_MILLION_TOKENS.get(settings.GROQ_CODE_MODEL, {"input": 0.59, "output": 0.79})
    cost = round((tokens_in * rates["input"] + tokens_out * rates["output"]) / 1_000_000, 8)

    # Parsear JSON de la respuesta
    result = _parse_json_response(response.content, code)

    # Guardar conversación
    conv = Conversation(
        session_id=session_id,
        user_email=user_email,
        module="code_review",
        model=settings.GROQ_CODE_MODEL,
        user_message=f"[{language.upper()}] {code[:300]}",
        assistant_message=json.dumps(result, ensure_ascii=False),
        tokens_used=tokens,
        cost_usd=cost,
        latency_ms=latency_ms,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)

    # Guardar evaluación
    eval_record = Evaluation(
        conversation_id=conv.id,
        module="code_review",
        evaluator="llm_judge",
        score=result.get("quality_score", 0.5),
        label="quality",
        explanation=result.get("summary", ""),
    )
    db.add(eval_record)
    db.commit()

    return {
        "summary": result.get("summary", "Revisión completada."),
        "issues": result.get("issues", []),
        "quality_score": float(result.get("quality_score", 0.5)),
        "security_score": float(result.get("security_score", 0.5)),
        "maintainability_score": float(result.get("maintainability_score", 0.5)),
        "corrected_code": str(result.get("corrected_code", code)),
        "tokens_used": tokens,
        "cost_usd": cost,
        "latency_ms": latency_ms,
    }


def _parse_json_response(content: str, fallback_code: str) -> dict:
    """Parsea JSON con tolerancia a markdown code blocks."""
    text = content.strip()

    # Quitar bloques markdown si los hay
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            cleaned = part.strip()
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
            if cleaned.startswith("{"):
                text = cleaned
                break

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Fallback: extraer el primer objeto JSON
        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(text[start:end])
            except Exception:
                pass

    logger.warning("No se pudo parsear JSON, usando fallback")
    return {
        "summary": content[:500],
        "issues": [],
        "quality_score": 0.5,
        "security_score": 0.5,
        "maintainability_score": 0.5,
        "corrected_code": fallback_code,
    }


def _extract_tokens(response) -> tuple[int, int]:
    """Extrae tokens de entrada y salida desde la respuesta LangChain/Groq."""
    try:
        meta = response.usage_metadata
        if meta:
            return (
                meta.get("input_tokens", 0),
                meta.get("output_tokens", 0),
            )
    except Exception:
        pass
    return (0, 0)

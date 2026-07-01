"""test_generator_service.py — Servicio de generación de tests unitarios con análisis de seguridad."""
import time
import json
import logging
from sqlalchemy.orm import Session
from app.core.llm_provider import get_langchain_llm
from app.core.config import settings
from app.models.conversation import Conversation

logger = logging.getLogger(__name__)

TEST_GENERATOR_PROMPT = """Eres un ingeniero de software senior con experiencia en testing, seguridad y calidad de código.
Recibe código fuente en {language} y debes:
1. Generar tests usando {framework}
2. Explicar qué hace el código
3. Identificar vulnerabilidades de seguridad

Responde OBLIGATORIAMENTE con dos bloques separados:
Primero, un bloque JSON con el análisis y métricas.
Segundo, un bloque de código con los tests generados.

Usa exactamente esta estructura:

```json
{{
  "coverage_estimate": 0.85,
  "test_count": 6,
  "explanation": "Descripción de qué hace el código y patrones utilizados.",
  "security_issues": [
    {{
      "severity": "critical",
      "title": "SQL Injection",
      "description": "Explicación del problema.",
      "line_hint": "Línea 5 aprox.",
      "recommendation": "Cómo solucionarlo."
    }}
  ]
}}
```

```python
// Código completo de los tests aquí
```

Reglas para los tests:
- Usa el framework solicitado: pytest para Python, jest para JavaScript/TypeScript, junit para Java.
- Incluye imports/fixtures necesarios.
- Cubre casos positivos, negativos y casos borde.

Reglas para security_issues:
- severity debe ser: "critical", "high", "medium" o "low"
- Si no hay vulnerabilidades, devuelve security_issues como []
- Detecta: SQL injection, XSS, CSRF, credenciales hardcodeadas, eval/exec inseguro,
  deserialización insegura, path traversal, command injection, weak crypto (MD5/SHA1),
  exposición de datos sensibles en logs o respuestas.

CÓDIGO A ANALIZAR ({language}):
```
{code}
```"""


def generate_tests(code: str, language: str, framework: str, session_id: str, db: Session, user_email: str = None) -> dict:
    """Genera tests unitarios y analiza vulnerabilidades de seguridad."""
    start = time.time()
    llm = get_langchain_llm(model=settings.GROQ_CODE_MODEL, temperature=0.0)

    from langchain_core.messages import HumanMessage, SystemMessage
    prompt = TEST_GENERATOR_PROMPT.format(language=language, framework=framework, code=code[:5000])

    try:
        response = llm.invoke([
            SystemMessage(content="Eres un experto en testing y seguridad de aplicaciones. Responde SIEMPRE con JSON válido y nada más."),
            HumanMessage(content=prompt),
        ])
    except Exception as e:
        raise RuntimeError(f"Error LLM: {e}")

    latency_ms = int((time.time() - start) * 1000)
    tokens_in, tokens_out = _extract_tokens(response)
    tokens_total = tokens_in + tokens_out
    cost = _estimate_cost(tokens_in, tokens_out, settings.GROQ_CODE_MODEL)

    result = _parse_json_response(response.content, code)

    # Normalizar security_issues
    raw_issues = result.get("security_issues") or []
    security_issues = []
    for issue in raw_issues:
        if isinstance(issue, dict):
            security_issues.append({
                "severity": str(issue.get("severity", "medium")),
                "title": str(issue.get("title", "Issue de seguridad")),
                "description": str(issue.get("description", "")),
                "line_hint": str(issue.get("line_hint", "")),
                "recommendation": str(issue.get("recommendation", "")),
            })
        elif isinstance(issue, str):
            security_issues.append({
                "severity": "medium",
                "title": "Issue detectado",
                "description": issue,
                "line_hint": "",
                "recommendation": "",
            })

    conv = Conversation(
        session_id=session_id,
        user_email=user_email,
        module="test_generator",
        model=settings.GROQ_CODE_MODEL,
        user_message=f"[{language.upper()}][{framework}] {code[:300]}",
        assistant_message=json.dumps(result, ensure_ascii=False),
        tokens_used=tokens_total,
        cost_usd=cost,
        latency_ms=latency_ms,
    )
    db.add(conv)
    db.commit()

    return {
        "generated_tests": str(result.get("generated_tests", "")),
        "coverage_estimate": float(result.get("coverage_estimate", 0.0)),
        "test_count": int(result.get("test_count", 0)),
        "explanation": str(result.get("explanation", "")),
        "security_issues": security_issues,
        "tokens_used": tokens_total,
        "cost_usd": cost,
        "latency_ms": latency_ms,
    }


def _parse_json_response(content: str, fallback_code: str) -> dict:
    import re as _re
    text = content.strip()
    
    # 1. Extraer JSON
    json_data = {}
    json_match = _re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', text)
    if json_match:
        try:
            json_data = json.loads(json_match.group(1))
        except Exception:
            pass
    else:
        # Intento de fallback para extraer JSON directo
        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            try:
                json_data = json.loads(text[start:end])
            except Exception:
                pass

    # 2. Extraer Código (buscando el bloque de código que no sea JSON)
    generated_code = ""
    # Buscar todos los bloques de código
    code_blocks = _re.findall(r'```([a-zA-Z0-9]*)\s*([\s\S]*?)```', text)
    for lang, code in code_blocks:
        if lang.lower() != 'json':
            generated_code += code.strip() + "\n\n"
            
    # Si no encontró bloque de código, asume que todo lo que no sea el JSON es código
    if not generated_code.strip():
        # Remover el JSON
        if json_match:
            generated_code = text.replace(json_match.group(0), "").strip()
        else:
            generated_code = text

    if not json_data and not generated_code.strip():
        logger.warning("No se pudo extraer nada de la respuesta. Cruda: %s", text[:300])
        return {
            "generated_tests": content if len(content) > 50 else "",
            "coverage_estimate": 0.0,
            "test_count": 0,
            "explanation": "El modelo respondió en formato inesperado. Intenta de nuevo.",
            "security_issues": [],
        }

    return {
        "generated_tests": generated_code.strip(),
        "coverage_estimate": float(json_data.get("coverage_estimate", 0.0)),
        "test_count": int(json_data.get("test_count", 0)),
        "explanation": str(json_data.get("explanation", "Sin explicación provista.")),
        "security_issues": json_data.get("security_issues", []),
    }


def _extract_tokens(response) -> tuple:
    try:
        meta = response.usage_metadata
        if meta:
            return (meta.get("input_tokens", 0), meta.get("output_tokens", 0))
    except Exception:
        pass
    return (0, 0)


def _estimate_cost(input_tokens: int, output_tokens: int, model: str) -> float:
    from app.services.chat_service import GROQ_COST_PER_MILLION_TOKENS
    rates = GROQ_COST_PER_MILLION_TOKENS.get(model, {"input": 0.10, "output": 0.10})
    cost = (input_tokens * rates["input"] + output_tokens * rates["output"]) / 1_000_000
    return round(cost, 8)

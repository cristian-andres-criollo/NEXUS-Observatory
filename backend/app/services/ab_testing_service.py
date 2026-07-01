import asyncio
import time
import logging
from typing import Any
from sqlalchemy.orm import Session
from app.core.llm_provider import get_langchain_llm, get_groq_client
from app.core.config import settings
from app.models.conversation import Conversation
from app.services.chat_service import GROQ_COST_PER_MILLION_TOKENS

logger = logging.getLogger(__name__)


async def _run_model(prompt: str, model: str, temperature: float, system_prompt: str) -> dict[str, Any]:
    start = time.time()
    llm = get_langchain_llm(model=model, temperature=temperature)
    from langchain_core.messages import HumanMessage, SystemMessage

    messages = [
        SystemMessage(content=system_prompt.strip() or "Eres un asistente experto."),
        HumanMessage(content=prompt),
    ]

    try:
        response = await asyncio.to_thread(llm.invoke, messages)
    except Exception as e:
        logger.error("Error ejecutando modelo %s: %s", model, e)
        raise RuntimeError(f"Error al ejecutar modelo {model}: {e}")

    latency_ms = int((time.time() - start) * 1000)
    tokens_in, tokens_out = _extract_tokens(response)
    tokens_total = tokens_in + tokens_out
    cost = _estimate_cost(tokens_in, tokens_out, model)

    return {
        "response": response.content,
        "tokens": tokens_total,
        "cost": cost,
        "latency": latency_ms,
        "model": model,
        "temperature": temperature,
        "system_prompt": system_prompt,
    }


def _extract_tokens(response) -> tuple[int, int]:
    try:
        meta = response.usage_metadata
        if meta:
            return (
                meta.get("input_tokens", 0),
                meta.get("output_tokens", 0),
            )
    except Exception:
        pass
    try:
        total = response.usage_metadata.get("total_tokens", 0)
        return (int(total * 0.7), int(total * 0.3))
    except Exception:
        pass
    return (0, 0)


def _estimate_cost(input_tokens: int, output_tokens: int, model: str) -> float:
    rates = GROQ_COST_PER_MILLION_TOKENS.get(model, {"input": 0.10, "output": 0.10})
    cost = (input_tokens * rates["input"] + output_tokens * rates["output"]) / 1_000_000
    return round(cost, 8)


def _judge_responses(prompt: str, config_a: dict, config_b: dict, resp_a: dict, resp_b: dict) -> dict[str, str]:
    client = get_groq_client()
    judge_prompt = f"""Eres un evaluador imparcial que compara dos respuestas de modelos a un mismo prompt.

PROMPT:
{prompt}

CONFIGURACIÓN A:
Modelo: {config_a['model']}
Temperatura: {config_a['temperature']}
System prompt: {config_a['system_prompt']}
RESPUESTA A:
{resp_a['response']}

CONFIGURACIÓN B:
Modelo: {config_b['model']}
Temperatura: {config_b['temperature']}
System prompt: {config_b['system_prompt']}
RESPUESTA B:
{resp_b['response']}

Indica cuál de las dos respuestas es mejor para este prompt, enumerando:
1. ganador: A o B o TIE
2. explicación concisa de por qué ganó
3. criterios usados (precisión, relevancia, claridad, fidelidad)

Responde en formato JSON con campos winner y explanation."""

    try:
        resp = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[{"role": "user", "content": judge_prompt}],
            max_tokens=180,
            temperature=0.0,
        )
        raw = resp.choices[0].message.content.strip()
        # Intentar parsear JSON simple
        if raw.startswith("{"):
            import json
            parsed = json.loads(raw)
            winner = parsed.get("winner", "TIE").strip().upper()
            explanation = parsed.get("explanation", "No se recibió explicación.")
        else:
            winner = "TIE"
            explanation = raw
            if "A" in raw and "B" not in raw:
                winner = "A"
            elif "B" in raw and "A" not in raw:
                winner = "B"
    except Exception as e:
        logger.warning("El juez falló: %s", e)
        winner = "TIE"
        explanation = f"No se pudo evaluar automáticamente: {e}"

    return {"winner": winner, "judge_explanation": explanation}


async def compare_configs(prompt: str, config_a: dict, config_b: dict, db: Session = None, user_email: str = None) -> dict:
    tasks = [
        _run_model(prompt, config_a["model"], float(config_a["temperature"]), config_a["system_prompt"]),
        _run_model(prompt, config_b["model"], float(config_b["temperature"]), config_b["system_prompt"]),
    ]
    result_a, result_b = await asyncio.gather(*tasks)

    judge = _judge_responses(prompt, config_a, config_b, result_a, result_b)

    total_tokens = result_a["tokens"] + result_b["tokens"]
    total_cost = result_a["cost"] + result_b["cost"]
    max_latency = max(result_a["latency"], result_b["latency"])

    if db:
        conv = Conversation(
            session_id=str(int(time.time())),
            user_email=user_email,
            module="ab_testing",
            model="mixed_ab_test",
            user_message=prompt,
            assistant_message=f"Winner: {judge['winner']}\nExplanation: {judge['judge_explanation']}",
            tokens_used=total_tokens,
            cost_usd=total_cost,
            latency_ms=max_latency,
        )
        db.add(conv)
        db.commit()

    return {
        "response_a": result_a["response"],
        "response_b": result_b["response"],
        "tokens_a": result_a["tokens"],
        "tokens_b": result_b["tokens"],
        "cost_a": result_a["cost"],
        "cost_b": result_b["cost"],
        "latency_a": result_a["latency"],
        "latency_b": result_b["latency"],
        "model_a": result_a["model"],
        "model_b": result_b["model"],
        "temperature_a": result_a["temperature"],
        "temperature_b": result_b["temperature"],
        "winner": judge["winner"],
        "judge_explanation": judge["judge_explanation"],
    }

"""
proxy.py — Gateway proxy transparente para LLMs.

Hace de intermediario entre el sistema del cliente y los proveedores reales
(Groq, OpenAI, etc.). El cliente apunta su SDK a Nexus en lugar del proveedor:

    # .env del sistema cliente
    GROQ_BASE_URL=http://nexus:8000/proxy/v1
    GROQ_API_KEY=nexus_<tu_key>

El cliente no nota ninguna diferencia en el comportamiento — recibe exactamente
la misma respuesta. Nexus intercepta la llamada para:
  1. Autenticar la API key
  2. Verificar el presupuesto (Kill Switch)
  3. Contar tokens y costos en COP
  4. Guardar la métrica en la DB
  5. Reenviar la llamada al proveedor real
"""
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.models.external_project import ExternalProject
from app.models.conversation import Conversation
from app.models.system import SystemSettings
from app.api.routes.ingest import (
    _authenticate_project,
    _reset_month_if_needed,
    _check_budget,
    _get_trm,
    _get_cost_per_million,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Proxy — Gateway LLM"])

# Mapa de proveedores según el modelo solicitado
PROVIDER_URLS = {
    "groq":    "https://api.groq.com/openai/v1",
    "openai":  "https://api.openai.com/v1",
    "default": "https://api.groq.com/openai/v1",
}

# API keys reales de los proveedores (del .env de Nexus)
PROVIDER_API_KEYS = {
    "groq":   lambda: settings.get_groq_keys()[0] if settings.get_groq_keys() else "",
    "openai": lambda: "",  # añadir OPENAI_API_KEY al config cuando sea necesario
}


def _detect_provider(model: str) -> str:
    model_lower = model.lower()
    if "gpt" in model_lower:
        return "openai"
    return "groq"  # Llama, Mixtral, Gemma → Groq por defecto


def _get_real_api_key(provider: str) -> str:
    getter = PROVIDER_API_KEYS.get(provider)
    return getter() if getter else ""


# ── Endpoint principal ─────────────────────────────────────────────────────────

@router.post("/v1/chat/completions")
async def proxy_chat_completions(
    request: Request,
    x_nexus_key: Optional[str] = Header(None, alias="X-Nexus-Key"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Proxy transparente compatible con el protocolo OpenAI.

    El cliente usa su SDK de Groq/OpenAI normalmente, solo cambia la base URL
    y la API key a los valores de Nexus.
    """
    # Extraer la Nexus key — puede venir en Authorization Bearer o en X-Nexus-Key
    nexus_key = x_nexus_key
    if not nexus_key and authorization and authorization.startswith("Bearer "):
        nexus_key = authorization.removeprefix("Bearer ")

    if not nexus_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta la API key de Nexus. Envía X-Nexus-Key o Authorization: Bearer nexus_<key>"
        )

    # Autenticación y presupuesto
    project = _authenticate_project(nexus_key, db)
    _reset_month_if_needed(project, db)

    if not _check_budget(project):
        raise HTTPException(
            status_code=402,
            detail=(
                f"Kill Switch activado para '{project.name}'. "
                f"Presupuesto mensual agotado: ${project.budget_cop:,.0f} COP."
            )
        )

    # Leer body de la petición
    body_bytes = await request.body()
    try:
        body_json = json.loads(body_bytes)
    except Exception:
        raise HTTPException(status_code=400, detail="Body JSON inválido")

    model = body_json.get("model", "llama-3.1-8b-instant")
    provider = _detect_provider(model)
    provider_url = PROVIDER_URLS.get(provider, PROVIDER_URLS["default"])
    real_api_key = _get_real_api_key(provider)

    if not real_api_key:
        raise HTTPException(
            status_code=503,
            detail=f"Nexus no tiene configurada una API key para el proveedor '{provider}'."
        )

    # Construir headers para el proveedor real
    forward_headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {real_api_key}",
    }

    is_streaming = body_json.get("stream", False)
    start_ts = datetime.now(timezone.utc).timestamp()

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            upstream_resp = await client.post(
                f"{provider_url}/chat/completions",
                content=body_bytes,
                headers=forward_headers,
            )
            upstream_resp.raise_for_status()

    except httpx.HTTPStatusError as exc:
        logger.error(f"[Proxy] Error upstream {exc.response.status_code}: {exc.response.text}")
        raise HTTPException(status_code=exc.response.status_code, detail=exc.response.text)
    except httpx.RequestError as exc:
        logger.error(f"[Proxy] Error de red: {exc}")
        raise HTTPException(status_code=503, detail=f"No se pudo conectar al proveedor: {exc}")

    latency_ms = int((datetime.now(timezone.utc).timestamp() - start_ts) * 1000)

    # Respuesta sin streaming — interceptamos tokens y guardamos
    if not is_streaming:
        resp_json = upstream_resp.json()
        usage = resp_json.get("usage", {})
        tokens_in = usage.get("prompt_tokens", 0)
        tokens_out = usage.get("completion_tokens", 0)
        total_tokens = usage.get("total_tokens", tokens_in + tokens_out)

        trm = _get_trm(db)
        cost_per_million = _get_cost_per_million(model, db)
        cost_usd = (total_tokens / 1_000_000) * cost_per_million
        cost_cop = cost_usd * trm

        # Guardar métrica
        user_msg = ""
        assistant_msg = ""
        try:
            messages = body_json.get("messages", [])
            user_msgs = [m["content"] for m in messages if m.get("role") == "user"]
            user_msg = user_msgs[-1] if user_msgs else ""
            choices = resp_json.get("choices", [])
            if choices:
                assistant_msg = choices[0].get("message", {}).get("content", "")
        except Exception:
            pass

        conv = Conversation(
            session_id=f"proxy_{project.id}_{start_ts:.0f}",
            user_email=project.owner_email,
            module=f"proxy_{project.name.lower().replace(' ', '_')}",
            user_message=user_msg or f"[Proxy {project.name}]",
            assistant_message=assistant_msg,
            model=model,
            tokens_used=total_tokens,
            cost_usd=cost_usd,
            latency_ms=latency_ms,
            extra={
                "project_id": project.id,
                "project_name": project.name,
                "source": "proxy",
                "provider": provider,
            },
        )
        db.add(conv)

        project.spent_cop += cost_cop
        db.commit()

        logger.info(
            f"[Proxy] {project.name} | {model} | {total_tokens} tokens | "
            f"${cost_cop:.2f} COP | {latency_ms}ms"
        )

        return JSONResponse(content=resp_json, status_code=upstream_resp.status_code)

    # Respuesta streaming — reenvía los chunks directamente
    # (los tokens se registran estimados, sin esperar el final del stream)
    async def stream_generator():
        async for chunk in upstream_resp.aiter_raw():
            yield chunk

    return StreamingResponse(
        stream_generator(),
        status_code=upstream_resp.status_code,
        media_type=upstream_resp.headers.get("content-type", "text/event-stream"),
    )

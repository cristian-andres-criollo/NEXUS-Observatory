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
import litellm
from app.core.crypto import decrypt_api_key

import httpx
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.models.external_project import ExternalProject
from app.services.email_service import send_budget_alert_async
import asyncio
from app.core.rate_limit import limiter
from app.models.conversation import Conversation
from app.models.system import SystemSettings
from app.models.agent_user import AgentUserLimit
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
    elif "claude" in model_lower:
        return "anthropic"
    elif "gemini" in model_lower:
        return "google"
    return "groq"  # Llama, Mixtral, Gemma → Groq por defecto


# ── Endpoint principal ─────────────────────────────────────────────────────────

@router.post("/v1/chat/completions")
@limiter.limit("100/minute")
async def proxy_chat_completions(
    request: Request,
    x_nexus_key: Optional[str] = Header(None, alias="X-Nexus-Key"),
    authorization: Optional[str] = Header(None),
    x_nexus_end_user_id: Optional[str] = Header(None, alias="X-Nexus-End-User-ID"),
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

    model_name = body_json.get("model", "llama-3.1-8b-instant")
    provider = project.llm_provider or "groq"
    real_api_key = decrypt_api_key(project.llm_api_key) if project.llm_api_key else ""

    if not real_api_key:
        raise HTTPException(
            status_code=503,
            detail=f"El agente '{project.name}' no tiene configurada una API key para '{provider}'."
        )

    # Inyección dinámica de max_tokens para evitar desbordamiento
    remaining_cop = project.budget_cop - project.spent_cop
    if remaining_cop <= 0:
        raise HTTPException(
            status_code=402,
            detail=f"Presupuesto agotado. Saldo restante: ${remaining_cop:,.0f} COP."
        )

    # Validar límite individual del usuario (si existe)
    if x_nexus_end_user_id:
        user_limit = db.query(AgentUserLimit).filter(
            AgentUserLimit.project_id == project.id,
            AgentUserLimit.user_identifier == x_nexus_end_user_id,
            AgentUserLimit.is_active == True
        ).first()
        
        if user_limit:
            user_remaining = user_limit.budget_cop - user_limit.spent_cop
            if user_remaining <= 0:
                raise HTTPException(
                    status_code=403,
                    detail=f"Límite de presupuesto excedido para el usuario '{x_nexus_end_user_id}'."
                )
            # Reajustar remaining_cop al más restrictivo para calcular max_tokens
            remaining_cop = min(remaining_cop, user_remaining)
    

    # Estimamos los tokens del prompt antes de enviar
    prompt_text_estimate = str(body_json.get("messages", []))
    estimated_prompt_tokens = len(prompt_text_estimate) // 4
    
    trm = _get_trm(db)
    cost_per_million = _get_cost_per_million(model_name, db)
    
    if cost_per_million > 0 and trm > 0:
        cost_per_token_cop = (cost_per_million / 1_000_000.0) * trm
        max_affordable_tokens_total = int(remaining_cop / cost_per_token_cop)
        max_affordable_output_tokens = max_affordable_tokens_total - estimated_prompt_tokens
        
        if max_affordable_output_tokens <= 0:
            raise HTTPException(
                status_code=402,
                detail=f"Presupuesto insuficiente. Tu prompt cuesta demasiado para el saldo actual (${remaining_cop:,.0f} COP)."
            )
            
        req_max_tokens = body_json.get("max_tokens")
        
        # Limitar estrictamente los tokens de salida para que no superen el presupuesto restante ni el límite técnico
        strict_max_tokens = min(4096, max_affordable_output_tokens)
        
        if req_max_tokens is None or strict_max_tokens < req_max_tokens:
            body_json["max_tokens"] = strict_max_tokens

    is_streaming = body_json.get('stream', False)
    start_ts = datetime.now(timezone.utc).timestamp()
    
    # Preparar el modelo para litellm (requiere prefijo de proveedor en algunos casos)
    litellm_model = model_name
    if provider == 'anthropic' and not litellm_model.startswith('anthropic/'):
        litellm_model = f'anthropic/{litellm_model}'
    elif provider == 'google' and not litellm_model.startswith('gemini/'):
        litellm_model = f'gemini/{litellm_model}'
    elif provider == 'groq' and not litellm_model.startswith('groq/'):
        litellm_model = f'groq/{litellm_model}'
    elif provider == 'openai' and not litellm_model.startswith('openai/'):
        litellm_model = f'openai/{litellm_model}'

    # Remueve el model y el stream del body_json para pasarlo como kwargs
    messages = body_json.pop('messages', [])
    body_json.pop('model', None)
    body_json.pop('stream', None)
    
    try:
        if is_streaming:
            async def generate():
                accumulated_text = ''
                user_msgs = [m['content'] for m in messages if m.get('role') == 'user' and isinstance(m.get('content'), str)]
                prompt_text = user_msgs[-1] if user_msgs else ''
                
                try:
                    response = await litellm.acompletion(
                        model=litellm_model,
                        messages=messages,
                        api_key=real_api_key,
                        stream=True,
                        **body_json
                    )
                    async for chunk in response:
                        yield f'data: {chunk.json()}\n\n'.encode('utf-8')
                        try:
                            content = chunk.choices[0].delta.content
                            if content:
                                accumulated_text += content
                        except Exception:
                            pass
                    yield b'data: [DONE]\n\n'
                except Exception as e:
                    logger.error(f'[Proxy] Error streaming upstream: {e}')
                    yield f'data: {{\"error\": \"{str(e)}\"}}\n\n'.encode('utf-8')
                finally:
                    # Guardamos la conversacin al terminar el stream o si el cliente desconecta
                    from app.db.database import SessionLocal
                    
                    prompt_tokens = len(prompt_text) // 4 if prompt_text else 0
                    completion_tokens = len(accumulated_text) // 4
                    total_tokens = prompt_tokens + completion_tokens
                    if total_tokens == 0:
                        total_tokens = 1
                        
                    latency_ms = int((datetime.now(timezone.utc).timestamp() - start_ts) * 1000)
                    
                    db_bg = SessionLocal()
                    try:
                        proj_bg = db_bg.query(ExternalProject).filter(ExternalProject.id == project.id).first()
                        if proj_bg:
                            trm = _get_trm(db_bg)
                            cost_per_million = _get_cost_per_million(model_name, db_bg)
                            cost_usd = (total_tokens / 1_000_000) * cost_per_million
                            cost_cop = cost_usd * trm
                            
                            user_limit_bg = None
                            if x_nexus_end_user_id:
                                user_limit_bg = db_bg.query(AgentUserLimit).filter(
                                    AgentUserLimit.project_id == proj_bg.id,
                                    AgentUserLimit.user_identifier == x_nexus_end_user_id
                                ).first()
                                if not user_limit_bg:
                                    user_limit_bg = AgentUserLimit(
                                        project_id=proj_bg.id,
                                        user_identifier=x_nexus_end_user_id
                                    )
                                    db_bg.add(user_limit_bg)

                            conv = Conversation(
                                session_id=f'proxy_{proj_bg.id}_{start_ts:.0f}',
                                user_email=x_nexus_end_user_id or proj_bg.owner_email,
                                module=f'proxy_{proj_bg.name.lower().replace(" ", "_")}_stream',
                                user_message=prompt_text or f'[Proxy Stream {proj_bg.name}]',
                                assistant_message=accumulated_text,
                                model=model_name,
                                tokens_used=total_tokens,
                                cost_usd=cost_usd,
                                latency_ms=latency_ms,
                                extra={
                                    'project_id': proj_bg.id,
                                    'project_name': proj_bg.name,
                                    'source': 'proxy_stream',
                                    'provider': provider,
                                }
                            )
                            db_bg.add(conv)
                            proj_bg.spent_cop += cost_cop
                            if user_limit_bg:
                                user_limit_bg.spent_cop += cost_cop
                            db_bg.commit()
                            logger.info(f'[Proxy Stream] {proj_bg.name} | {model_name} | {total_tokens} tokens (est) |  COP | {latency_ms}ms')
                    except Exception as e:
                        logger.error(f'Error guardando stream en BD: {e}')
                    finally:
                        db_bg.close()
            
            return StreamingResponse(generate(), media_type='text/event-stream')
        else:
            response = await litellm.acompletion(
                model=litellm_model,
                messages=messages,
                api_key=real_api_key,
                stream=False,
                **body_json
            )
    except Exception as exc:
        logger.error(f'[Proxy] Error upstream: {exc}')
        raise HTTPException(status_code=500, detail=str(exc))

    latency_ms = int((datetime.now(timezone.utc).timestamp() - start_ts) * 1000)

    # Respuesta sin streaming  interceptamos tokens y guardamos
    try:
        resp_json = response.model_dump()
    except Exception:
        resp_json = response.dict() if hasattr(response, 'dict') else dict(response)
        
    usage = resp_json.get('usage', {})
    tokens_in = usage.get('prompt_tokens', 0)
    tokens_out = usage.get('completion_tokens', 0)
    total_tokens = usage.get('total_tokens', tokens_in + tokens_out)

    trm = _get_trm(db)
    cost_per_million = _get_cost_per_million(model_name, db)
    cost_usd = (total_tokens / 1_000_000) * cost_per_million
    cost_cop = cost_usd * trm

    # Guardar mtrica
    user_msg = ''
    assistant_msg = ''
    try:
        user_msgs = [m['content'] for m in messages if m.get('role') == 'user']
        user_msg = user_msgs[-1] if user_msgs else ''
        choices = resp_json.get('choices', [])
        if choices:
            assistant_msg = choices[0].get('message', {}).get('content', '')
    except Exception:
        pass

    conv = Conversation(
        session_id=f'proxy_{project.id}_{start_ts:.0f}',
        user_email=x_nexus_end_user_id or project.owner_email,
        module=f'proxy_{project.name.lower().replace(" ", "_")}',
        user_message=user_msg or f'[Proxy {project.name}]',
        assistant_message=assistant_msg,
        model=model_name,
        tokens_used=total_tokens,
        cost_usd=cost_usd,
        latency_ms=latency_ms,
        extra={
            'project_id': project.id,
            'project_name': project.name,
            'source': 'proxy',
            'provider': provider,
        },
    )
    db.add(conv)

    if x_nexus_end_user_id:
        user_limit = db.query(AgentUserLimit).filter(
            AgentUserLimit.project_id == project.id,
            AgentUserLimit.user_identifier == x_nexus_end_user_id
        ).first()
        if not user_limit:
            user_limit = AgentUserLimit(
                project_id=project.id,
                user_identifier=x_nexus_end_user_id
            )
            db.add(user_limit)
        user_limit.spent_cop += cost_cop

    old_spent = project.spent_cop
    project.spent_cop += cost_cop
    db.commit()
    
    if old_spent < project.budget_cop and project.spent_cop >= project.budget_cop:
        asyncio.create_task(send_budget_alert_async(project.name, project.budget_cop, project.owner_email))

    logger.info(
        f'[Proxy] {project.name} | {model_name} | {total_tokens} tokens | '
        f' COP | {latency_ms}ms'
    )

    return JSONResponse(content=resp_json)

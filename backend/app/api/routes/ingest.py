"""
ingest.py — Endpoint de recepción de métricas de sistemas externos.

Los sistemas cliente (Luminary, chatbots, agentes, etc.) reportan aquí
sus llamadas a LLMs. Nexus valida la API key, verifica el presupuesto en COP,
guarda la conversación y devuelve el estado del kill switch.

Uso desde el sistema cliente:
    import requests
    requests.post("https://nexus.com/api/v1/ingest",
        headers={"X-Nexus-Key": "nexus_abc123..."},
        json={
            "model": "llama-3.3-70b-versatile",
            "tokens_in": 450,
            "tokens_out": 312,
            "latency_ms": 1200,
            "module": "session_report"   # etiqueta libre
        }
    )
"""
import hashlib
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.external_project import ExternalProject
from app.models.conversation import Conversation
from app.models.system import SystemSettings

router = APIRouter(tags=["Ingest — Proyectos Externos"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_trm(db: Session) -> float:
    s = db.query(SystemSettings).first()
    return float(s.trm_usd_cop) if s else 4200.0


def _get_cost_per_million(model: str, db: Session) -> float:
    """Devuelve el costo en USD por millón de tokens según el modelo."""
    s = db.query(SystemSettings).first()
    model_lower = model.lower()
    if "gpt" in model_lower or "openai" in model_lower:
        return float(s.openai_cost_per_million) if s else 10.0
    if "claude" in model_lower or "anthropic" in model_lower:
        return float(s.anthropic_cost_per_million) if s else 15.0
    if "gemini" in model_lower or "google" in model_lower:
        return float(s.google_cost_per_million) if s else 7.0
    # Groq / Llama por defecto
    return float(s.groq_cost_per_million) if s else 0.69


def _authenticate_project(nexus_key: str, db: Session) -> ExternalProject:
    """Valida la API key y retorna el proyecto. Lanza 401 si es inválida."""
    key_hash = hashlib.sha256(nexus_key.encode()).hexdigest()
    project = db.query(ExternalProject).filter(
        ExternalProject.api_key_hash == key_hash
    ).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key inválida. Verifica tu X-Nexus-Key."
        )
    if not project.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este proyecto está desactivado. Contacta al administrador de Nexus."
        )
    return project


def _reset_month_if_needed(project: ExternalProject, db: Session):
    """Resetea el gasto mensual si el mes cambió."""
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    if project.budget_month != current_month:
        project.spent_cop = 0.0
        project.budget_month = current_month
        db.commit()


def _check_budget(project: ExternalProject) -> bool:
    """Retorna True si hay saldo, False si el kill switch debe activarse."""
    if project.budget_cop <= 0:
        return True  # sin límite definido = sin restricción
    return project.spent_cop < project.budget_cop


# ── Schemas ────────────────────────────────────────────────────────────────────

class IngestRequest(BaseModel):
    model: str                                # "llama-3.3-70b-versatile", "gpt-4o", etc.
    tokens_in: int = 0                        # tokens del prompt
    tokens_out: int = 0                       # tokens de la respuesta
    latency_ms: int = 0                       # latencia de la llamada
    module: Optional[str] = "external"        # etiqueta libre del módulo/función
    user_message: Optional[str] = ""          # prompt (opcional, puede omitirse por privacidad)
    assistant_message: Optional[str] = ""     # respuesta (opcional)

    class Config:
        json_schema_extra = {
            "example": {
                "model": "gpt-4o",
                "tokens_in": 150,
                "tokens_out": 300,
                "latency_ms": 1250,
                "module": "chat_general",
                "user_message": "¿Cuál es la capital de Francia?",
                "assistant_message": "La capital de Francia es París."
            }
        }


class IngestResponse(BaseModel):
    ok: bool
    project: str
    tokens_total: int
    cost_usd: float
    cost_cop: float
    budget_cop: float
    spent_cop: float
    budget_remaining_cop: float
    kill_switch: bool                         # True = se bloqueará la próxima llamada


# ── Endpoint principal ─────────────────────────────────────────────────────────

@router.post(
    "/ingest",
    response_model=IngestResponse,
    summary="Ingestar métricas de LLM",
    description="Recibe los datos de una petición a un LLM desde un sistema externo. Verifica el presupuesto en tiempo real, convierte el gasto a COP y evalúa el Kill Switch."
)
def ingest_metrics(
    body: IngestRequest,
    x_nexus_key: str = Header(..., alias="X-Nexus-Key"),
    db: Session = Depends(get_db),
):
    """
    Recibe métricas de uso de tokens desde un sistema externo.
    Autenticación: header `X-Nexus-Key: nexus_<tu_key>`.
    """
    project = _authenticate_project(x_nexus_key, db)
    _reset_month_if_needed(project, db)

    # Verificar presupuesto ANTES de registrar
    if not _check_budget(project):
        raise HTTPException(
            status_code=402,
            detail=(
                f"Presupuesto agotado para '{project.name}'. "
                f"Límite: ${project.budget_cop:,.0f} COP | "
                f"Gastado: ${project.spent_cop:,.0f} COP"
            )
        )

    # Calcular costo
    trm = _get_trm(db)
    cost_per_million = _get_cost_per_million(body.model, db)
    total_tokens = body.tokens_in + body.tokens_out
    cost_usd = (total_tokens / 1_000_000) * cost_per_million
    cost_cop = cost_usd * trm

    # Guardar en la tabla conversations (reutiliza el modelo existente)
    conv = Conversation(
        session_id=f"ext_{project.id}_{datetime.now(timezone.utc).timestamp():.0f}",
        user_email=project.owner_email,
        module=body.module or project.name.lower().replace(" ", "_"),
        user_message=body.user_message or f"[Ingest desde {project.name}]",
        assistant_message=body.assistant_message or "",
        model=body.model,
        tokens_used=total_tokens,
        cost_usd=cost_usd,
        latency_ms=body.latency_ms,
        extra={"project_id": project.id, "project_name": project.name, "source": "ingest"},
    )
    db.add(conv)

    # Actualizar gasto del proyecto
    project.spent_cop += cost_cop
    db.commit()

    remaining = max(0.0, project.budget_cop - project.spent_cop)
    kill_next = not _check_budget(project)

    return IngestResponse(
        ok=True,
        project=project.name,
        tokens_total=total_tokens,
        cost_usd=round(cost_usd, 6),
        cost_cop=round(cost_cop, 2),
        budget_cop=project.budget_cop,
        spent_cop=round(project.spent_cop, 2),
        budget_remaining_cop=round(remaining, 2),
        kill_switch=kill_next,
    )

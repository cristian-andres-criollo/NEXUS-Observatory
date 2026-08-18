"""
admin.py — Router de administración de NEXUS Observatory.

Gestiona el presupuesto Enterprise en Pesos Colombianos (COP),
calcula automáticamente los tokens comprados según las tarifas de Groq
y la TRM simulada, y distribuye equitativamente entre usuarios.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, EmailStr
from typing import List, Optional

from app.db.database import get_db
from app.models.user import User
from app.models.system import SystemSettings, PaymentMethod
from app.models.conversation import Conversation
from app.models.external_project import ExternalProject, generate_api_key, hash_api_key
from app.core.crypto import encrypt_api_key, mask_api_key, decrypt_api_key
from app.api.routes.auth import get_current_admin_user, get_password_hash
from fastapi import HTTPException, status
from datetime import datetime, timezone

router = APIRouter(tags=["Admin"])

# ── Helpers de cálculo ─────────────────────────────────────────────────────────

def _calculate_tokens_from_cop(budget_cop: int, trm: float, cost_per_million: float) -> int:
    """
    Calcula cuántos tokens se pueden comprar con un presupuesto en COP.
    
    Fórmula: (budget_cop / trm) / cost_per_million * 1_000_000
    Ejemplo: ($500.000 COP / $4.200) / $0.69 por millón * 1M = ~172.536 tokens
    """
    if trm <= 0 or cost_per_million <= 0:
        return 0
    budget_usd = budget_cop / trm
    tokens = (budget_usd / cost_per_million) * 1_000_000
    return int(tokens)

def _get_settings(db: Session) -> SystemSettings:
    s = db.query(SystemSettings).first()
    if not s:
        s = SystemSettings(budget_cop=500000, trm_usd_cop=4200.0, groq_cost_per_million=0.69, anthropic_cost_per_million=15.0, openai_cost_per_million=10.0, google_cost_per_million=7.0)
        db.add(s)
        db.commit()
    return s

# ── Schemas Pydantic ───────────────────────────────────────────────────────────

class AdminUserCreate(BaseModel):
    email: str
    password: str
    role: str
    plan: str

class AdminUserUpdate(BaseModel):
    password: str | None = None
    role: str | None = None
    plan: str | None = None

class BudgetUpdateRequest(BaseModel):
    budget_cop: int
    trm_usd_cop: float | None = None
    groq_cost_per_million: float | None = None

class LLMSettingsUpdateRequest(BaseModel):
    llm_provider: str

class PaymentMethodOut(BaseModel):
    id: int
    card_holder: str
    card_type: str
    bank_name: str
    last_four: str
    available_balance_cop: int
    is_active: bool
    color_from: str
    color_to: str

class UserStatsResponse(BaseModel):
    email: str
    role: str
    plan: str
    tokens_used: int
    token_limit: int
    usage_percentage: float

class ProjectOut(BaseModel):
    id: int
    name: str
    description: str | None
    owner_email: str
    api_key_prefix: str
    plan: str
    budget_cop: float
    spent_cop: float
    is_active: bool
    functions: str
    llm_provider: str
    llm_api_key: str | None
    created_at: str

class AdminDashboardResponse(BaseModel):
    budget_cop: int
    total_tokens_purchased: int
    trm_usd_cop: float
    trm_rates: dict  # {"COP": ..., "MXN": ..., "ARS": ..., "CLP": ..., "PEN": ...}
    groq_cost_per_million: float
    anthropic_cost_per_million: float
    openai_cost_per_million: float
    google_cost_per_million: float
    total_users: int
    token_limit_per_user: int
    payment_methods: List[PaymentMethodOut]
    users: List[UserStatsResponse]
    projects: List[ProjectOut]
    llm_provider: str

# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/admin/dashboard", response_model=AdminDashboardResponse)
def get_admin_dashboard(db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin_user)):
    s = _get_settings(db)
    
    # Calcular tokens comprables con el presupuesto en COP (usando Groq como base por ahora)
    total_tokens = _calculate_tokens_from_cop(int(s.budget_cop), float(s.trm_usd_cop), float(s.groq_cost_per_million))
    
    users = db.query(User).all()
    total_users_count = max(len(users), 1)
    limit_per_user = total_tokens // total_users_count

    # Métricas por usuario
    user_stats = []
    for u in users:
        user_plan = getattr(u, 'plan', 'free')
        used = db.query(func.sum(Conversation.tokens_used)).filter(Conversation.user_email == u.email).scalar() or 0
        
        limit = limit_per_user
        
        pct = min(100.0, (used / limit) * 100) if limit > 0 else 0.0
        user_stats.append({
            "email": str(u.email),
            "role": str(u.role),
            "plan": str(user_plan),
            "tokens_used": int(used),
            "token_limit": int(limit),
            "usage_percentage": round(pct, 2)
        })
    
    # Tarjetas de pago simuladas
    cards = db.query(PaymentMethod).all()
    cards_out = [{c: getattr(pm, c) for c in PaymentMethodOut.model_fields} for pm in cards]

    # Proyectos Externos (Agentes)
    projects = db.query(ExternalProject).order_by(ExternalProject.created_at.desc()).all()
    projects_out = [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "owner_email": p.owner_email,
            "api_key_prefix": p.api_key_prefix,
            "plan": p.plan,
            "budget_cop": p.budget_cop,
            "spent_cop": p.spent_cop,
            "is_active": p.is_active,
            "functions": p.functions or "",
            "llm_provider": p.llm_provider or "groq",
            "llm_api_key": mask_api_key(decrypt_api_key(p.llm_api_key)) if p.llm_api_key else None,
            "created_at": str(p.created_at),
        }
        for p in projects
    ]

    return AdminDashboardResponse(
        budget_cop=int(s.budget_cop),
        total_tokens_purchased=int(total_tokens),
        trm_usd_cop=float(s.trm_usd_cop),
        trm_rates={
            "COP": float(getattr(s, 'trm_usd_cop', 4200.0)),
            "MXN": float(getattr(s, 'trm_usd_mxn', 17.5)),
            "ARS": float(getattr(s, 'trm_usd_ars', 950.0)),
            "CLP": float(getattr(s, 'trm_usd_clp', 940.0)),
            "PEN": float(getattr(s, 'trm_usd_pen', 3.7)),
        },
        groq_cost_per_million=float(s.groq_cost_per_million),
        anthropic_cost_per_million=float(s.anthropic_cost_per_million),
        openai_cost_per_million=float(s.openai_cost_per_million),
        google_cost_per_million=float(s.google_cost_per_million),
        total_users=len(users),
        token_limit_per_user=int(limit_per_user),
        payment_methods=cards_out,
        users=user_stats,
        projects=projects_out,
        llm_provider=s.llm_provider or "groq",
    )

@router.put("/admin/budget")
def update_budget(req: BudgetUpdateRequest, db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin_user)):
    s = _get_settings(db)
    s.budget_cop = req.budget_cop
    if req.trm_usd_cop is not None:
        s.trm_usd_cop = req.trm_usd_cop
    if req.groq_cost_per_million is not None:
        s.groq_cost_per_million = req.groq_cost_per_million
    db.commit()
    return {"message": "Presupuesto actualizado"}

@router.post("/admin/users")
def admin_create_user(user_in: AdminUserCreate, db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin_user)):
    """
    Permite al administrador crear usuarios directamente y asignarles
    el rol deseado. El plan es forzosamente Enterprise.
    Límite máximo de 50 cuentas.
    """
    enterprise_count = db.query(User).filter(User.created_by_admin == True).count()
    if enterprise_count >= 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Límite máximo de 50 cuentas Enterprise alcanzado."
        )

    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo electrónico ya está registrado."
        )
    
    hashed_pwd = get_password_hash(user_in.password)
    new_user = User(
        email=user_in.email,
        hashed_password=hashed_pwd,
        role=user_in.role,
        plan="enterprise", # Siempre enterprise
        created_by_admin=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "Usuario creado exitosamente", "email": new_user.email, "plan": new_user.plan, "role": new_user.role}

@router.put("/admin/users/{email}")
def admin_update_user(email: str, user_in: AdminUserUpdate, db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin_user)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user_in.password:
        user.hashed_password = get_password_hash(user_in.password)
    if user_in.role:
        user.role = user_in.role
    if user_in.plan:
        user.plan = user_in.plan
        
    db.commit()
    db.refresh(user)
    return {"message": "Usuario actualizado", "email": user.email, "plan": user.plan, "role": user.role}

@router.delete("/admin/users/{email}")
def admin_delete_user(email: str, db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin_user)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    if user.email == current_admin.email:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta de administrador en sesión")
        
    db.delete(user)
    db.commit()
    return {"message": "Usuario eliminado exitosamente"}

@router.put("/admin/settings")
def update_admin_settings(req: BudgetUpdateRequest, db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin_user)):
    s = _get_settings(db)
    s.budget_cop = req.budget_cop
    if req.trm_usd_cop is not None:
        s.trm_usd_cop = req.trm_usd_cop
    if req.groq_cost_per_million is not None:
        s.groq_cost_per_million = req.groq_cost_per_million
    db.commit()
    
    total_tokens = _calculate_tokens_from_cop(int(s.budget_cop), float(s.trm_usd_cop), float(s.groq_cost_per_million))
    users = db.query(User).all()
    enterprise_users = [u for u in users if getattr(u, 'plan', 'free') == 'enterprise' or u.role == 'admin']
    total_enterprise = max(len(enterprise_users), 1)
    limit_per_enterprise = total_tokens // total_enterprise if total_enterprise > 0 else 0

    return {
        "budget_cop": int(s.budget_cop),
        "trm_usd_cop": float(s.trm_usd_cop),
        "groq_cost_per_million": float(s.groq_cost_per_million),
    }

@router.put("/admin/settings/llm")
def update_llm_settings(req: LLMSettingsUpdateRequest, db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin_user)):
    s = _get_settings(db)
    s.llm_provider = req.llm_provider
    db.commit()
    return {
        "message": "Configuración de motor de IA actualizada",
        "llm_provider": s.llm_provider
    }

# ── Gestión de Proyectos Externos (API Keys para clientes) ─────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    owner_email: EmailStr
    plan: str = "free"
    budget_cop: float = 0.0
    functions: str = ""
    llm_provider: str = "groq"
    llm_api_key: Optional[str] = None


class ProjectOut(BaseModel):
    id: int
    name: str
    description: str | None
    owner_email: str
    api_key_prefix: str
    plan: str
    budget_cop: float
    spent_cop: float
    is_active: bool
    functions: str
    llm_provider: str
    llm_api_key: str | None
    created_at: str


@router.post("/admin/projects")
def create_project(
    req: ProjectCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """
    Crea un proyecto externo y emite su API key.
    La key plana se devuelve UNA SOLA VEZ — Nexus solo guarda el hash.
    """
    raw_key = generate_api_key()
    project = ExternalProject(
        name=req.name,
        description=req.description,
        owner_email=current_admin.email,
        api_key_hash=hash_api_key(raw_key),
        api_key_prefix=raw_key[:12],
        plan=req.plan,
        budget_cop=req.budget_cop,
        functions=req.functions,
        spent_cop=0.0,
        budget_month=datetime.now(timezone.utc).strftime("%Y-%m"),
        is_active=True,
        llm_provider=req.llm_provider,
        llm_api_key=encrypt_api_key(req.llm_api_key) if req.llm_api_key else None,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return {
        "message": "Proyecto creado exitosamente",
        "id": project.id,
        "name": project.name,
        "api_key": raw_key,          # ← solo se muestra aquí, una única vez
        "api_key_prefix": project.api_key_prefix,
        "plan": project.plan,
        "budget_cop": project.budget_cop,
    }


@router.get("/admin/projects", response_model=List[ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """Lista todos los proyectos externos registrados."""
    projects = db.query(ExternalProject).order_by(ExternalProject.created_at.desc()).all()
    return [
        ProjectOut(
            id=p.id,
            name=p.name,
            description=p.description,
            owner_email=p.owner_email,
            api_key_prefix=p.api_key_prefix,
            plan=p.plan,
            budget_cop=p.budget_cop,
            spent_cop=p.spent_cop,
            is_active=p.is_active,
            functions=p.functions or "",
            llm_provider=p.llm_provider or "groq",
            llm_api_key=mask_api_key(decrypt_api_key(p.llm_api_key)) if p.llm_api_key else None,
            created_at=str(p.created_at),
        )
        for p in projects
    ]


@router.put("/admin/projects/{project_id}")
def update_project(
    project_id: int,
    req: ProjectCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """Actualiza nombre, descripción, plan y presupuesto de un proyecto."""
    project = db.query(ExternalProject).filter(ExternalProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    project.name = req.name
    project.description = req.description
    project.plan = req.plan
    project.budget_cop = req.budget_cop
    project.functions = req.functions
    project.llm_provider = req.llm_provider
    if req.llm_api_key and "..." not in req.llm_api_key:
        project.llm_api_key = encrypt_api_key(req.llm_api_key)
    db.commit()
    return {"message": "Proyecto actualizado", "id": project.id}


@router.delete("/admin/projects/{project_id}")
def deactivate_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """Desactiva el proyecto (kill switch permanente). No borra los datos históricos."""
    project = db.query(ExternalProject).filter(ExternalProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    project.is_active = False
    db.commit()
    return {"message": f"Proyecto '{project.name}' desactivado"}

@router.delete("/admin/projects/{project_id}/hard")
def delete_project_permanently(
    project_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """Borra el proyecto permanentemente (hard delete) de la base de datos."""
    project = db.query(ExternalProject).filter(ExternalProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    db.delete(project)
    db.commit()
    return {"message": f"Proyecto '{project.name}' eliminado permanentemente"}


@router.post("/admin/projects/{project_id}/reset-key")
def reset_project_key(
    project_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """
    Rota la API key del proyecto. La key anterior queda inválida de inmediato.
    La nueva key se muestra UNA SOLA VEZ.
    """
    project = db.query(ExternalProject).filter(ExternalProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    raw_key = generate_api_key()
    project.api_key_hash = hash_api_key(raw_key)
    project.api_key_prefix = raw_key[:12]
    db.commit()
    return {
        "message": "API key rotada exitosamente",
        "api_key": raw_key,
        "api_key_prefix": project.api_key_prefix,
    }



from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List, Optional

from app.db.database import get_db
from app.api.routes.auth import get_current_admin_user
from app.models.user import User
from app.models.external_project import ExternalProject
from app.models.agent_user import AgentUserLimit
from app.models.conversation import Conversation

class AgentUserLimitCreate(BaseModel):
    user_identifier: str
    budget_cop: Optional[int] = None
    is_active: bool = True

class AgentUserLimitUpdate(BaseModel):
    budget_cop: Optional[int] = None
    is_active: Optional[bool] = None

@router.get("/admin/projects/{project_id}/users")
def list_project_users(
    project_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    project = db.query(ExternalProject).filter(ExternalProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        
    limits = db.query(AgentUserLimit).filter(AgentUserLimit.project_id == project_id).all()
    
    # También obtener todos los usuarios únicos que han usado el proxy
    active_users = db.query(Conversation.user_email, func.sum(Conversation.cost_usd)).filter(
        Conversation.user_email != project.owner_email,
        Conversation.module.like("proxy_%")
    ).group_by(Conversation.user_email).all()
    
    # Combinar
    result = []
    limit_dict = {L.user_identifier: L for L in limits}
    
    for user_email, _ in active_users:
        if not user_email:
            continue
        if user_email in limit_dict:
            L = limit_dict[user_email]
            result.append({
                "id": L.id,
                "user_identifier": L.user_identifier,
                "budget_cop": L.budget_cop,
                "spent_cop": L.spent_cop,
                "is_active": L.is_active
            })
            del limit_dict[user_email]
        else:
            result.append({
                "id": None,
                "user_identifier": user_email,
                "budget_cop": None,
                "spent_cop": 0, # Could calculate actual spend here
                "is_active": True
            })
            
    for L in limit_dict.values():
        result.append({
            "id": L.id,
            "user_identifier": L.user_identifier,
            "budget_cop": L.budget_cop,
            "spent_cop": L.spent_cop,
            "is_active": L.is_active
        })
        
    return result

@router.post("/admin/projects/{project_id}/users/autodistribute")
def auto_distribute_project_user_budget(
    project_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    project = db.query(ExternalProject).filter(ExternalProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        
    # Get explicitly created limits
    active_limits = db.query(AgentUserLimit).filter(
        AgentUserLimit.project_id == project_id,
        AgentUserLimit.is_active == True
    ).all()
    
    limit_identifiers = {L.user_identifier for L in active_limits}
    
    # Get implicit users from conversations
    implicit_users = db.query(Conversation.user_email).filter(
        Conversation.user_email != project.owner_email,
        Conversation.module.like("proxy_%")
    ).group_by(Conversation.user_email).all()
    
    # Create limits for implicit users that don't have one
    new_limits = []
    for (user_email,) in implicit_users:
        if user_email and user_email not in limit_identifiers:
            new_limit = AgentUserLimit(
                project_id=project_id,
                user_identifier=user_email,
                is_active=True
            )
            db.add(new_limit)
            new_limits.append(new_limit)
            limit_identifiers.add(user_email)
            
    # Combine old and new
    all_active_users = active_limits + new_limits
    
    if not all_active_users:
        raise HTTPException(status_code=400, detail="No hay usuarios activos ni conversaciones para distribuir el presupuesto")
        
    equal_budget = project.budget_cop / len(all_active_users)
    
    for user in all_active_users:
        user.budget_cop = equal_budget
        
    db.commit()
    return {"message": "Presupuesto distribuido equitativamente", "budget_per_user": equal_budget}

@router.post("/admin/projects/{project_id}/users")
def add_project_user_limit(
    project_id: int,
    data: AgentUserLimitCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    project = db.query(ExternalProject).filter(ExternalProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        
    existing = db.query(AgentUserLimit).filter(
        AgentUserLimit.project_id == project_id,
        AgentUserLimit.user_identifier == data.user_identifier
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="El usuario ya tiene un límite configurado")
        
    new_limit = AgentUserLimit(
        project_id=project_id,
        user_identifier=data.user_identifier,
        budget_cop=data.budget_cop,
        is_active=data.is_active
    )
    db.add(new_limit)
    db.commit()
    db.refresh(new_limit)
    return new_limit

@router.put("/admin/projects/{project_id}/users/{limit_id}")
def update_project_user_limit(
    project_id: int,
    limit_id: int,
    data: AgentUserLimitUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    limit = db.query(AgentUserLimit).filter(
        AgentUserLimit.id == limit_id,
        AgentUserLimit.project_id == project_id
    ).first()
    
    if not limit:
        raise HTTPException(status_code=404, detail="Límite no encontrado")
        
    if data.budget_cop is not None:
        limit.budget_cop = data.budget_cop
    if data.is_active is not None:
        limit.is_active = data.is_active
        
    db.commit()
    db.refresh(limit)
    return limit

@router.delete("/admin/projects/{project_id}/users/{limit_id}")
def delete_project_user_limit(
    project_id: int,
    limit_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    limit = db.query(AgentUserLimit).filter(
        AgentUserLimit.id == limit_id,
        AgentUserLimit.project_id == project_id
    ).first()
    
    if not limit:
        raise HTTPException(status_code=404, detail="Límite no encontrado")
        
    db.delete(limit)
    db.commit()
    return {"message": "Límite eliminado"}

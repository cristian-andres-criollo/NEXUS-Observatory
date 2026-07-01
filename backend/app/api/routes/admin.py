"""
admin.py — Router de administración de NEXUS Observatory.

Gestiona el presupuesto Enterprise en Pesos Colombianos (COP),
calcula automáticamente los tokens comprados según las tarifas de Groq
y la TRM simulada, y distribuye equitativamente entre usuarios.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List

from app.db.database import get_db
from app.models.user import User
from app.models.system import SystemSettings, PaymentMethod
from app.models.conversation import Conversation
from app.api.routes.auth import get_current_admin_user, get_password_hash
from app.core.ollama_controller import check_ollama_status, start_ollama_server, stop_ollama_server
from fastapi import HTTPException, status

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
        s = SystemSettings(budget_cop=500000, trm_usd_cop=4200.0, groq_cost_per_million=0.69)
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
    ollama_base_url: str
    ollama_model: str

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

class AdminDashboardResponse(BaseModel):
    budget_cop: int
    total_tokens_purchased: int
    trm_usd_cop: float
    groq_cost_per_million: float
    total_users: int
    token_limit_per_user: int
    payment_methods: List[PaymentMethodOut]
    users: List[UserStatsResponse]
    llm_provider: str
    ollama_base_url: str
    ollama_model: str

# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/admin/dashboard", response_model=AdminDashboardResponse)
def get_admin_dashboard(db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin_user)):
    s = _get_settings(db)
    
    # Calcular tokens comprables con el presupuesto en COP
    total_tokens = _calculate_tokens_from_cop(int(s.budget_cop), float(s.trm_usd_cop), float(s.groq_cost_per_million))
    
    users = db.query(User).filter(User.created_by_admin == True).all()
    enterprise_users = [u for u in users if getattr(u, 'plan', 'free') == 'enterprise' or u.role == 'admin']
    total_enterprise = max(len(enterprise_users), 1)
    limit_per_enterprise = total_tokens // total_enterprise

    # Métricas por usuario
    user_stats = []
    for u in users:
        user_plan = getattr(u, 'plan', 'free')
        used = db.query(func.sum(Conversation.tokens_used)).filter(Conversation.user_email == u.email).scalar() or 0
        
        if user_plan == 'enterprise' or u.role == 'admin':
            limit = limit_per_enterprise
        else:
            limit = 0  # Free users don't have token budget
        
        pct = min(100.0, (used / limit) * 100) if limit > 0 else 0.0
        user_stats.append(UserStatsResponse(
            email=str(u.email),
            role=str(u.role),
            plan=str(user_plan),
            tokens_used=int(used),
            token_limit=int(limit),
            usage_percentage=round(pct, 2)
        ))
    
    # Tarjetas de pago simuladas
    cards = db.query(PaymentMethod).all()
    cards_out = [PaymentMethodOut(**{c: getattr(pm, c) for c in PaymentMethodOut.model_fields}) for pm in cards]

    return AdminDashboardResponse(
        budget_cop=int(s.budget_cop),
        total_tokens_purchased=int(total_tokens),
        trm_usd_cop=float(s.trm_usd_cop),
        groq_cost_per_million=float(s.groq_cost_per_million),
        total_users=len(users),
        token_limit_per_user=int(limit_per_enterprise),
        payment_methods=cards_out,
        users=user_stats,
        llm_provider=s.llm_provider or "groq",
        ollama_base_url=s.ollama_base_url or "http://localhost:11434",
        ollama_model=s.ollama_model or "llama3",
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
    s.ollama_base_url = req.ollama_base_url
    s.ollama_model = req.ollama_model
    db.commit()
    return {
        "message": "Configuración de motor de IA actualizada",
        "llm_provider": s.llm_provider,
        "ollama_base_url": s.ollama_base_url,
        "ollama_model": s.ollama_model
    }

# ── Endpoints de Ollama ────────────────────────────────────────────────────────

@router.get("/admin/ollama/status")
async def get_ollama_status(db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin_user)):
    s = _get_settings(db)
    status_str = await check_ollama_status(s.ollama_base_url or "http://localhost:11434")
    return {"status": status_str}

@router.post("/admin/ollama/start")
def post_start_ollama(current_admin: User = Depends(get_current_admin_user)):
    success = start_ollama_server()
    if not success:
        raise HTTPException(status_code=500, detail="No se pudo iniciar el proceso de Ollama")
    return {"message": "Servidor Ollama iniciando..."}

@router.post("/admin/ollama/stop")
def post_stop_ollama(current_admin: User = Depends(get_current_admin_user)):
    success = stop_ollama_server()
    if not success:
        raise HTTPException(status_code=500, detail="No se pudo detener el proceso de Ollama")
    return {"message": "Servidor Ollama detenido"}

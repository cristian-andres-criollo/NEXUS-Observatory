from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import bcrypt
import jwt
from pydantic import BaseModel
from app.db.database import get_db
from app.models.user import User
from app.models.system import SystemSettings
from app.models.conversation import Conversation
from app.core.config import settings
import secrets
import asyncio
from sqlalchemy import func
from app.services.email_service import send_2fa_code_async, send_recovery_token_async

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 días

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    email: str
    viewed_context_tabs: str
    theme_color: str
    plan: str
    full_name: Optional[str] = None
    profile_picture: Optional[str] = None
    custom_ai_instructions: Optional[str] = None
    language: Optional[str] = None
    hardware_specs: Optional[str] = None

class PreferencesUpdate(BaseModel):
    viewed_context_tabs: str

class ThemeUpdate(BaseModel):
    theme_color: str

class UserProfileUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    profile_picture: Optional[str] = None
    custom_ai_instructions: Optional[str] = None
    language: Optional[str] = None
    hardware_specs: Optional[str] = None

class UserCreate(BaseModel):
    email: str
    password: str

class Verify2FARequest(BaseModel):
    email: str
    code: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class Toggle2FARequest(BaseModel):
    enabled: bool


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc).replace(tzinfo=None) + expires_delta
    else:
        expire = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@router.post("/auth/login")
async def login(background_tasks: BackgroundTasks, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.role == "admin" and getattr(user, 'plan', None) != "enterprise":
        user.plan = "enterprise"
        db.commit()
        db.refresh(user)
        
    if getattr(user, 'two_factor_enabled', False):
        code = str(secrets.randbelow(1000000)).zfill(6)
        user.two_factor_code = code
        user.two_factor_expires = __import__('datetime').datetime.now(__import__('datetime').timezone.utc) + __import__('datetime').timedelta(minutes=10)
        db.commit()
        background_tasks.add_task(send_2fa_code_async, user.email, code)
        return {"requires_2fa": True, "email": user.email}
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "email": user.email,
        "viewed_context_tabs": user.viewed_context_tabs or "{}",
        "theme_color": user.theme_color or "default",
        "plan": user.plan or "free",
        "full_name": user.full_name,
        "profile_picture": user.profile_picture,
        "custom_ai_instructions": user.custom_ai_instructions,
        "language": user.language or "es",
        "hardware_specs": user.hardware_specs
    }

@router.post("/auth/register")
def register(user_in: UserCreate, db: Session = Depends(get_db)):
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
        role="admin",
        plan="enterprise"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "Usuario registrado exitosamente", "email": new_user.email, "plan": new_user.plan}

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: Optional[str] = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
        
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

def get_current_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
    return current_user

def check_token_limit(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "admin":
        return current_user

    # Solo aplica a enterprise y team — los community no pasan por aquí para chat    
    if getattr(current_user, 'plan', 'community') == 'community':
        return current_user
        
    sys_settings = db.query(SystemSettings).first()
    if sys_settings:
        budget_cop = float(sys_settings.budget_cop)
        trm = float(sys_settings.trm_usd_cop or 4200.0)
        cost_pm = float(sys_settings.groq_cost_per_million or 0.69)
    else:
        budget_cop, trm, cost_pm = 500000.0, 4200.0, 0.69
    
    # Repartir tokens entre usuarios Team y Enterprise
    total_users = max(db.query(User).filter(User.plan.in_(["enterprise", "team"])).count(), 1)
    budget_usd = budget_cop / trm
    total_tokens = int((budget_usd / cost_pm) * 1_000_000)
    limit_per_user = total_tokens // total_users
    
    used = db.query(func.sum(Conversation.tokens_used)).filter(Conversation.user_email == current_user.email).scalar() or 0
    
    if used >= limit_per_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=f"Límite de tokens de la bolsa compartida alcanzado ({int(used):,}/{int(limit_per_user):,}). Contacta al administrador."
        )
        
    return current_user


# ── Límites del plan gratuito (Community) ─────────────────────────────────────
FREE_PLAN_LIMITS = {
    "rag":        10,   # 10 análisis de documentos por mes
    "repo_agent": 5,    # 5 usos de funciones de repositorio por mes
    "code_review": 5,   # 5 code reviews por mes
}

def check_free_plan_limit(module: str):
    """
    Factory que retorna una dependencia FastAPI para verificar
    los límites mensuales del plan community en un módulo específico.
    
    - Community: limitado por FREE_PLAN_LIMITS[module] al mes
    - Team/Enterprise: pasa directo (usa check_token_limit en su lugar)
    - Admin: siempre pasa
    """
    limit = FREE_PLAN_LIMITS.get(module, 999)

    def _check(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
        # Admin y team/enterprise pasan sin restricciones de conteo mensual
        plan = getattr(current_user, 'plan', 'community')
        if current_user.role == "admin" or plan in ["enterprise", "team"]:
            return current_user

        # Contar usos del mes actual
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        used_this_month = db.query(Conversation).filter(
            Conversation.user_email == current_user.email,
            Conversation.module == module,
            Conversation.created_at >= start_of_month
        ).count()

        if used_this_month >= limit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Límite mensual del plan Community alcanzado para este módulo ({used_this_month}/{limit}). "
                       f"Contacta al administrador para actualizar a Team o Enterprise."
            )
        return current_user

    return _check

@router.put("/auth/me/preferences")
def update_preferences(prefs: PreferencesUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    setattr(current_user, 'viewed_context_tabs', prefs.viewed_context_tabs)
    from sqlalchemy.orm.session import object_session
    if object_session(current_user) is not None:
        db.commit()
        db.refresh(current_user)
    return {"message": "Preferencias actualizadas", "viewed_context_tabs": current_user.viewed_context_tabs}

@router.put("/auth/me/theme")
def update_theme(prefs: ThemeUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    setattr(current_user, 'theme_color', prefs.theme_color)
    from sqlalchemy.orm.session import object_session
    if object_session(current_user) is not None:
        db.commit()
        db.refresh(current_user)
    return {"message": "Tema actualizado", "theme_color": current_user.theme_color}

@router.put("/auth/me/profile")
def update_profile(profile: UserProfileUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    
    if profile.email is not None:
        current_user.email = profile.email
    if profile.full_name is not None:

        current_user.full_name = profile.full_name
    if profile.profile_picture is not None:
        current_user.profile_picture = profile.profile_picture
    if profile.custom_ai_instructions is not None:
        current_user.custom_ai_instructions = profile.custom_ai_instructions
    if profile.language is not None:
        current_user.language = profile.language
    if profile.hardware_specs is not None:
        current_user.hardware_specs = profile.hardware_specs
    
    # Auto-upgrade admins to enterprise when they update profile as well
    if current_user.role == "admin" and getattr(current_user, 'plan', None) != "enterprise":
        current_user.plan = "enterprise"

    from sqlalchemy.orm.session import object_session
    if object_session(current_user) is not None:
        db.commit()
        db.refresh(current_user)
    return {
        "message": "Perfil actualizado exitosamente",
        "full_name": current_user.full_name,
        "profile_picture": current_user.profile_picture,
        "custom_ai_instructions": current_user.custom_ai_instructions,
        "language": current_user.language,
        "hardware_specs": current_user.hardware_specs,
        "plan": current_user.plan
    }

@router.post("/auth/verify-2fa")
def verify_2fa(req: Verify2FARequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not user.two_factor_code:
        raise HTTPException(status_code=400, detail="Código inválido o expirado")
        
    now = __import__('datetime').datetime.now(__import__('datetime').timezone.utc)
    if user.two_factor_expires:
        expires = user.two_factor_expires
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=__import__('datetime').timezone.utc)
        if now > expires:
            raise HTTPException(status_code=400, detail="El código ha expirado")
        
    if user.two_factor_code != req.code:
        raise HTTPException(status_code=400, detail="Código incorrecto")
        
    user.two_factor_code = None
    user.two_factor_expires = None
    db.commit()
    
    access_token_expires = __import__('datetime').timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "email": user.email,
        "viewed_context_tabs": user.viewed_context_tabs or "{}",
        "theme_color": user.theme_color or "default",
        "plan": user.plan or "free",
        "full_name": user.full_name,
        "profile_picture": user.profile_picture,
        "custom_ai_instructions": user.custom_ai_instructions,
        "language": user.language or "es",
        "two_factor_enabled": getattr(user, 'two_factor_enabled', False)
    }

@router.post("/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if user:
        token = str(secrets.randbelow(1000000)).zfill(6)
        user.recovery_token = token
        user.recovery_expires = __import__('datetime').datetime.now(__import__('datetime').timezone.utc) + __import__('datetime').timedelta(minutes=15)
        db.commit()
        background_tasks.add_task(send_recovery_token_async, user.email, token)
    return {"message": "Si el correo existe, recibirás un enlace de recuperación."}

@router.post("/auth/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.recovery_token == req.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Token inválido")
        
    now = __import__('datetime').datetime.now(__import__('datetime').timezone.utc)
    if user.recovery_expires:
        # Si la BD devuelve timezone naive (ej. SQLite), asumimos UTC. Si devuelve aware (ej. Postgres), no hay problema.
        expires = user.recovery_expires
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=__import__('datetime').timezone.utc)
        if now > expires:
            raise HTTPException(status_code=400, detail="El token ha expirado")
        
    user.hashed_password = get_password_hash(req.new_password)
    user.recovery_token = None
    user.recovery_expires = None
    db.commit()
    return {"message": "Contraseña actualizada exitosamente"}

@router.put("/auth/me/2fa/toggle")
def toggle_2fa(req: Toggle2FARequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.two_factor_enabled = req.enabled
    db.commit()
    return {"message": f"2FA activado" if req.enabled else "2FA desactivado"}

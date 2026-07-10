from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.finops_db import get_finops_db
from app.services.metrics_service import get_global_metrics, get_latency_history, get_cost_history
from app.schemas.metrics import GlobalMetrics
from app.api.routes.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/metrics", tags=["Metrics"])

@router.get("/", response_model=GlobalMetrics)
def global_metrics(personal: bool = False, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        personal = True
    user_email = current_user.email if personal else None
    return get_global_metrics(db, user_email)

@router.get("/latency")
def latency_history(personal: bool = False, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        personal = True
    user_email = current_user.email if personal else None
    return get_latency_history(db, 25, user_email)

@router.get("/cost")
def cost_history(personal: bool = False, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        personal = True
    user_email = current_user.email if personal else None
    return get_cost_history(db, 25, user_email)

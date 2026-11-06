from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.finops_db import get_finops_db
from app.services.metrics_service import get_global_metrics, get_latency_history, get_cost_history
from app.schemas.metrics import GlobalMetrics
from app.api.routes.auth import get_current_user
from app.models.user import User
from app.models.external_project import ExternalProject
from fastapi import HTTPException


def _scope(db: Session, current_user: User, project_id):
    """Cada cuenta solo ve sus métricas: sus conversaciones y las de sus agentes."""
    owned = [pid for (pid,) in db.query(ExternalProject.id).filter(
        ExternalProject.owner_email == current_user.email).all()]
    if project_id is not None and project_id not in owned:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return current_user.email, owned

router = APIRouter(prefix="/metrics", tags=["Metrics"])

@router.get("/", response_model=GlobalMetrics)
def global_metrics(personal: bool = False, project_id: int = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user_email, owned = _scope(db, current_user, project_id)
    return get_global_metrics(db, user_email, project_id, owned)

@router.get("/latency")
def latency_history(personal: bool = False, project_id: int = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user_email, owned = _scope(db, current_user, project_id)
    return get_latency_history(db, 25, user_email, project_id, owned)

@router.get("/cost")
def cost_history(personal: bool = False, project_id: int = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user_email, owned = _scope(db, current_user, project_id)
    return get_cost_history(db, 25, user_email, project_id, owned)

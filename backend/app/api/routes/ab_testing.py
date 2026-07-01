from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.api.routes.auth import get_current_user, check_token_limit
from app.models.user import User
from app.schemas.ab_testing import ABCompareRequest, ABCompareResponse
from app.services.ab_testing_service import compare_configs

router = APIRouter(prefix="/ab", tags=["A/B Testing"])


@router.post("/compare", response_model=ABCompareResponse)
async def compare_ab(req: ABCompareRequest, db: Session = Depends(get_db), current_user: User = Depends(check_token_limit)):
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="El prompt no puede estar vacío")
    try:
        result = await compare_configs(req.prompt, req.config_a.dict(), req.config_b.dict(), db, current_user.email)
        return ABCompareResponse(**result)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {e}")

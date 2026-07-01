from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat_service import chat, chat_stream
from app.api.routes.auth import check_token_limit
from app.models.user import User

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post("/", response_model=ChatResponse)
def send_message(req: ChatRequest, db: Session = Depends(get_db), current_user: User = Depends(check_token_limit)):
    try:
        result = chat(req.message, req.session_id, db, current_user.email, req.temperature, req.max_tokens)
        return ChatResponse(**result)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {e}")

@router.post("/stream")
def stream_message(req: ChatRequest, db: Session = Depends(get_db), current_user: User = Depends(check_token_limit)):
    try:
        return chat_stream(req.message, req.session_id, db, current_user.email, req.temperature, req.max_tokens)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {e}")

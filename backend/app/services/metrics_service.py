from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.conversation import Conversation
from app.models.user import User

def _get_enterprise_emails(db: Session) -> list:
    users = db.query(User.email).filter(User.created_by_admin == True).all()
    return [u[0] for u in users]

def get_global_metrics(db: Session, user_email: str = None) -> dict:
    query_base = db.query(Conversation)
    ent_emails = [] if user_email else _get_enterprise_emails(db)
    
    if user_email:
        query_base = query_base.filter(Conversation.user_email == user_email)
    elif ent_emails:
        query_base = query_base.filter(Conversation.user_email.in_(ent_emails))
    else:
        query_base = query_base.filter(False) # No data if no enterprise users
        
    total = db.query(func.count(Conversation.id)).filter(
        Conversation.user_email == user_email if user_email else (Conversation.user_email.in_(ent_emails) if ent_emails else False)
    ).scalar() or 0
    
    total_tokens = db.query(func.sum(Conversation.tokens_used)).filter(
        Conversation.user_email == user_email if user_email else (Conversation.user_email.in_(ent_emails) if ent_emails else False)
    ).scalar() or 0
    
    total_cost = db.query(func.sum(Conversation.cost_usd)).filter(
        Conversation.user_email == user_email if user_email else (Conversation.user_email.in_(ent_emails) if ent_emails else False)
    ).scalar() or 0.0
    
    avg_latency = db.query(func.avg(Conversation.latency_ms)).filter(
        Conversation.user_email == user_email if user_email else (Conversation.user_email.in_(ent_emails) if ent_emails else False)
    ).scalar() or 0.0
    
    avg_hall = db.query(func.avg(Conversation.hallucination_score)).filter(
        Conversation.hallucination_score.isnot(None),
        Conversation.user_email == user_email if user_email else (Conversation.user_email.in_(ent_emails) if ent_emails else False)
    ).scalar()

    # Conteo por módulo
    q_mod = db.query(Conversation.module, func.count(Conversation.id))
    if user_email:
        q_mod = q_mod.filter(Conversation.user_email == user_email)
    elif ent_emails:
        q_mod = q_mod.filter(Conversation.user_email.in_(ent_emails))
    else:
        q_mod = q_mod.filter(False)
    rows = q_mod.group_by(Conversation.module).all()
    by_module = {module: count for module, count in rows}

    # Conversaciones recientes
    q_recent = db.query(Conversation)
    if user_email:
        q_recent = q_recent.filter(Conversation.user_email == user_email)
    elif ent_emails:
        q_recent = q_recent.filter(Conversation.user_email.in_(ent_emails))
    else:
        q_recent = q_recent.filter(False)
    recent = q_recent.order_by(Conversation.created_at.desc()).limit(15).all()

    top_user = None
    top_user_conversations = 0
    top_users = []
    if not user_email and ent_emails:
        from sqlalchemy import desc
        top_user_rows = (
            db.query(Conversation.user_email, func.count(Conversation.id))
            .filter(Conversation.user_email.in_(ent_emails))
            .group_by(Conversation.user_email)
            .order_by(desc(func.count(Conversation.id)))
            .limit(5)
            .all()
        )
        if top_user_rows:
            top_user = top_user_rows[0][0]
            top_user_conversations = top_user_rows[0][1]
            top_users = [{"user_email": r[0], "conversations": r[1]} for r in top_user_rows]

    recent_list = [
        {
            "id": c.id,
            "module": c.module,
            "user_message": c.user_message[:80],
            "tokens_used": c.tokens_used,
            "cost_usd": c.cost_usd,
            "latency_ms": c.latency_ms,
            "hallucination_score": c.hallucination_score,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in recent
    ]

    return {
        "total_conversations": total,
        "total_tokens": int(total_tokens),
        "total_cost_usd": round(float(total_cost), 8),
        "avg_latency_ms": round(float(avg_latency), 1),
        "avg_hallucination_score": round(float(avg_hall), 3) if avg_hall is not None else None,
        "conversations_by_module": by_module,
        "recent_conversations": recent_list,
        "top_user": top_user,
        "top_user_conversations": top_user_conversations,
        "top_users": top_users,
    }


def get_latency_history(db: Session, limit: int = 25, user_email: str = None) -> list:
    q = db.query(Conversation.created_at, Conversation.latency_ms, Conversation.module)
    if user_email:
        q = q.filter(Conversation.user_email == user_email)
    else:
        ent_emails = _get_enterprise_emails(db)
        if ent_emails:
            q = q.filter(Conversation.user_email.in_(ent_emails))
        else:
            q = q.filter(False)
    rows = q.order_by(Conversation.created_at.desc()).limit(limit).all()
    return [
        {"time": r.created_at.isoformat() if r.created_at else "", "latency": r.latency_ms, "module": r.module}
        for r in reversed(rows)
    ]


def get_cost_history(db: Session, limit: int = 25, user_email: str = None) -> list:
    q = db.query(Conversation.created_at, Conversation.cost_usd, Conversation.module)
    if user_email:
        q = q.filter(Conversation.user_email == user_email)
    else:
        ent_emails = _get_enterprise_emails(db)
        if ent_emails:
            q = q.filter(Conversation.user_email.in_(ent_emails))
        else:
            q = q.filter(False)
    rows = q.order_by(Conversation.created_at.desc()).limit(limit).all()
    return [
        {"time": r.created_at.isoformat() if r.created_at else "", "cost": r.cost_usd, "module": r.module}
        for r in reversed(rows)
    ]

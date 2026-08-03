from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.conversation import Conversation

def get_global_metrics(db: Session, user_email: str = None, project_id: int = None) -> dict:
    where_clause = "WHERE 1=1"
    params = {}
    
    from app.core.config import settings
    is_sqlite = settings.DATABASE_URL.startswith("sqlite")
    
    if user_email:
        where_clause += " AND c.user_email = :email"
        params["email"] = user_email
    
    if project_id:
        if is_sqlite:
            where_clause += " AND json_extract(c.extra, '$.project_id') = :project_id"
        else:
            where_clause += " AND CAST(c.extra->>'project_id' AS INTEGER) = :project_id"
        params["project_id"] = project_id

    q_totals = f"""
        SELECT 
            COUNT(c.id) as total,
            COALESCE(SUM(c.tokens_used), 0) as total_tokens,
            COALESCE(SUM(c.cost_usd), 0.0) as total_cost,
            COALESCE(AVG(c.latency_ms), 0.0) as avg_latency,
            COALESCE(AVG(c.hallucination_score), 0.0) as avg_hallucination
        FROM conversations c
        {where_clause}
    """
    totals = db.execute(text(q_totals), params).fetchone()

    q_mod = f"""
        SELECT c.module, COUNT(c.id)
        FROM conversations c
        {where_clause}
        GROUP BY c.module
    """
    mod_rows = db.execute(text(q_mod), params).fetchall()
    by_module = {row[0]: row[1] for row in mod_rows}

    q_recent = f"""
        SELECT c.id, c.module, c.model, c.user_message, c.tokens_used, c.cost_usd, c.latency_ms, c.hallucination_score, c.created_at, c.session_id, c.assistant_message
        FROM conversations c
        {where_clause}
        ORDER BY c.created_at DESC
        LIMIT 15
    """
    recent_rows = db.execute(text(q_recent), params).fetchall()
    recent_list = []
    for r in recent_rows:
        recent_list.append({
            "id": str(r[0]),
            "module": r[1],
            "model": r[2] or "llama-3.1-8b-instant",
            "user_message": r[3] or "",
            "tokens_used": r[4],
            "cost_usd": float(r[5] or 0.0),
            "latency_ms": int(r[6] or 0),
            "hallucination_score": float(r[7] or 0.0),
            "created_at": r[8].isoformat() + "Z" if hasattr(r[8], 'isoformat') else str(r[8]) + "Z" if r[8] else None,
            "trace_id": r[9],
            "assistant_message": r[10] or ""
        })

    top_user = None
    top_user_conversations = 0
    top_users = []
    
    if not user_email and not project_id:
        q_top = """
            SELECT c.user_email, COUNT(c.id) as cnt
            FROM conversations c
            WHERE c.user_email IS NOT NULL
            GROUP BY c.user_email
            ORDER BY cnt DESC
            LIMIT 5
        """
        top_rows = db.execute(text(q_top)).fetchall()
        if top_rows:
            top_user = top_rows[0][0]
            top_user_conversations = top_rows[0][1]
            top_users = [{"user_email": r[0], "conversations": r[1]} for r in top_rows]

    return {
        "total_conversations": totals[0] or 0,
        "total_tokens": int(totals[1] or 0),
        "total_cost_usd": round(float(totals[2] or 0.0), 8),
        "avg_latency_ms": float(totals[3] or 0.0),
        "avg_hallucination_score": float(totals[4] or 0.0) if totals[4] is not None else None,
        "conversations_by_module": by_module,
        "recent_conversations": recent_list,
        "top_user": top_user,
        "top_user_conversations": top_user_conversations,
        "top_users": top_users,
    }

def get_latency_history(db: Session, limit: int = 25, user_email: str = None, project_id: int = None) -> list:
    where_clause = "WHERE 1=1"
    params = {"limit": limit}
    
    from app.core.config import settings
    is_sqlite = settings.DATABASE_URL.startswith("sqlite")

    if user_email:
        where_clause += " AND c.user_email = :email"
        params["email"] = user_email
    
    if project_id:
        if is_sqlite:
            where_clause += " AND json_extract(c.extra, '$.project_id') = :project_id"
        else:
            where_clause += " AND CAST(c.extra->>'project_id' AS INTEGER) = :project_id"
        params["project_id"] = project_id
        
    q = f"""
        SELECT c.created_at, c.latency_ms, c.module
        FROM conversations c
        {where_clause}
        ORDER BY c.created_at DESC
        LIMIT :limit
    """
    rows = db.execute(text(q), params).fetchall()
    
    return [
        {
            "timestamp": r[0].isoformat() + "Z" if hasattr(r[0], 'isoformat') else str(r[0]) + "Z" if r[0] else "", 
            "latency": int(r[1] or 0), 
            "module": r[2]
        }
        for r in reversed(rows)
    ]

def get_cost_history(db: Session, limit: int = 25, user_email: str = None, project_id: int = None) -> list:
    where_clause = "WHERE 1=1"
    params = {"limit": limit}
    
    from app.core.config import settings
    is_sqlite = settings.DATABASE_URL.startswith("sqlite")

    if user_email:
        where_clause += " AND c.user_email = :email"
        params["email"] = user_email
        
    if project_id:
        if is_sqlite:
            where_clause += " AND json_extract(c.extra, '$.project_id') = :project_id"
        else:
            where_clause += " AND CAST(c.extra->>'project_id' AS INTEGER) = :project_id"
        params["project_id"] = project_id
        
    q = f"""
        SELECT c.created_at, c.cost_usd, c.module, c.tokens_used
        FROM conversations c
        {where_clause}
        ORDER BY c.created_at DESC
        LIMIT :limit
    """
    rows = db.execute(text(q), params).fetchall()
    
    return [
        {
            "timestamp": r[0].isoformat() + "Z" if hasattr(r[0], 'isoformat') else str(r[0]) + "Z" if r[0] else "", 
            "cost_usd": float(r[1] or 0.0), 
            "module": r[2],
            "tokens": r[3] or 0
        }
        for r in reversed(rows)
    ]

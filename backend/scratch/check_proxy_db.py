from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os

# Add parent to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import get_db, SessionLocal
from app.models.agent_user import AgentUserLimit

def check_db():
    db = SessionLocal()
    limits = db.query(AgentUserLimit).filter(AgentUserLimit.project_id == 2).all()
    for L in limits:
        print(f"User: {L.user_identifier}, Spent: {L.spent_cop}, Budget: {L.budget_cop}")
    db.close()

if __name__ == "__main__":
    check_db()

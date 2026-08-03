import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from app.db.database import Base
from app.models.agent_user import AgentUserLimit

def fix_db():
    engine = create_engine('sqlite:///nexus.db')
    print("Dropping agent_user_limits...")
    AgentUserLimit.__table__.drop(engine, checkfirst=True)
    print("Recreating agent_user_limits...")
    AgentUserLimit.__table__.create(engine, checkfirst=True)
    print("Done!")

if __name__ == "__main__":
    fix_db()

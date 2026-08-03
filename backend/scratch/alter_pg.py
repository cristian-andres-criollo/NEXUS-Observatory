import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.database import engine

def fix_postgres_db():
    with engine.connect() as conn:
        print(f"Connected to {engine.url}")
        if "postgresql" in engine.url.drivername:
            print("Altering columns to DOUBLE PRECISION in postgres...")
            conn.execute(text("ALTER TABLE agent_user_limits ALTER COLUMN spent_cop TYPE DOUBLE PRECISION"))
            conn.execute(text("ALTER TABLE agent_user_limits ALTER COLUMN budget_cop TYPE DOUBLE PRECISION"))
            conn.commit()
            print("Done!")
        else:
            print("Not using Postgres, using SQLite. Dropping table.")
            conn.execute(text("DROP TABLE IF EXISTS agent_user_limits"))
            conn.commit()
            print("Done!")

if __name__ == "__main__":
    fix_postgres_db()

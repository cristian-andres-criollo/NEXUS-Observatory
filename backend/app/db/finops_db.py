import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.database import normalize_db_url

# URL por defecto si no está en docker
FINOPS_DATABASE_URL = normalize_db_url(os.getenv("FINOPS_DATABASE_URL", "postgresql://nexus_admin:nexus_secure_password@localhost:5432/nexus_db"))

finops_engine = create_engine(
    FINOPS_DATABASE_URL,
    pool_pre_ping=True,
)
FinopsSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=finops_engine)

def get_finops_db():
    db = FinopsSessionLocal()
    try:
        yield db
    finally:
        db.close()

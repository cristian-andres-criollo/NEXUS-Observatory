import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.db.database import normalize_db_url

# Si no se define FINOPS_DATABASE_URL se reutiliza la base principal (sin credenciales embebidas)
FINOPS_DATABASE_URL = normalize_db_url(os.getenv("FINOPS_DATABASE_URL") or settings.DATABASE_URL)

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

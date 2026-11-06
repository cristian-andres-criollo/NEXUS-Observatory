import pytest
import sys
import os

# Fuerza a que settings use SQLite file-based
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
# Clave fija solo para pruebas (la app exige SECRET_KEY de >= 32 caracteres)
os.environ.setdefault("SECRET_KEY", "test-only-secret-key-not-for-production-use-0123456789")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient

from app.main import app
from app.db.database import Base, get_db, engine, SessionLocal, create_tables
from app.models import conversation, document, document_chunk, evaluation, user, system, external_project, billing, agent_user
from app.core.rate_limit import limiter

# Disable rate limiting for tests
limiter.enabled = False

@pytest.fixture(autouse=True)
def setup_database():
    """Crea y destruye la base de datos de prueba para cada test."""
    Base.metadata.drop_all(bind=engine)
    create_tables()
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db_session():
    """Provee una sesión de DB limpia para cada test."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def client(db_session):
    """Cliente de pruebas de FastAPI con la base de datos mockeada."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

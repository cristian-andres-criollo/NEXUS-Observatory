import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.observability import setup_observability
from app.db.database import create_tables
from app.api.routes import chat, metrics, ab_testing, export, auth, webauthn, admin

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("uvicorn.access").setLevel(logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Iniciando NEXUS Observatory Standalone...")
    create_tables()
    setup_observability()
    logger.info("✅ NEXUS Observatory listo")
    yield
    logger.info("👋 Apagando NEXUS Observatory")


app = FastAPI(
    title="NEXUS Observatory API",
    description="Sistema de observabilidad de LLMs y Control de Tokens",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"
app.include_router(auth,      prefix=PREFIX)
app.include_router(admin.router, prefix=PREFIX)
app.include_router(chat,      prefix=PREFIX)
app.include_router(metrics,   prefix=PREFIX)
app.include_router(ab_testing, prefix=PREFIX)
app.include_router(export,    prefix=PREFIX)
app.include_router(webauthn,  prefix=PREFIX)


@app.get("/")
def root():
    return {
        "app": "NEXUS Observatory Standalone",
        "version": "1.0.0",
        "status": "operational",
        "docs": "/docs",
        "modules": ["chat_demo", "ab_testing", "token_gateway"],
        "observability_tools": ["LangSmith", "Helicone", "W&B Weave", "Arize Phoenix"],
    }


@app.get("/health")
def health():
    return {"status": "ok"}

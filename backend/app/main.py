import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from app.core.config import settings
from app.core.observability import setup_observability
from app.db.database import create_tables
from app.api.routes import metrics, export, auth, webauthn, admin, ingest, proxy

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("uvicorn.access").setLevel(logging.INFO)
logger = logging.getLogger(__name__)


import asyncio
from app.services.scheduler_service import start_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Iniciando NEXUS Observatory Standalone...")
    create_tables()
    setup_observability()
    
    # Iniciar la tarea en segundo plano
    scheduler_task = asyncio.create_task(start_scheduler())
    
    logger.info("✅ NEXUS Observatory listo")
    yield
    logger.info("👋 Apagando NEXUS Observatory")
    scheduler_task.cancel()


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
app.include_router(auth,           prefix=PREFIX)
app.include_router(admin.router,   prefix=PREFIX)
app.include_router(metrics,        prefix=PREFIX)
app.include_router(export,         prefix=PREFIX)
app.include_router(webauthn,       prefix=PREFIX)
app.include_router(ingest.router,  prefix=PREFIX)

app.include_router(proxy.router,   prefix="/proxy")

@app.get("/api")
def root():
    return {
        "app": "NEXUS Observatory Standalone",
        "version": "1.0.0",
        "status": "operational",
        "docs": "/docs",
        "modules": ["dashboard", "finops", "token_gateway"],
        "observability_tools": ["LangSmith", "Helicone", "W&B Weave", "Arize Phoenix"],
    }


@app.get("/health")
def health():
    return {"status": "ok"}

# Montar los assets estáticos (CSS/JS)
if os.path.isdir("static/assets"):
    app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")

# SPA Catch-all: cualquier otra ruta devuelve index.html
@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    index_path = os.path.join("static", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"error": "Frontend no compilado. Ejecuta el build y cópialo a /static."}
# reload
# reload


# reload

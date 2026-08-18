import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.requests import Request
import os
import asyncio

from app.core.config import settings
from app.core.observability import setup_observability
from app.db.database import create_tables
from app.api.routes import metrics, export, auth, webauthn, admin, ingest, proxy
from app.services.scheduler_service import start_scheduler

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.core.rate_limit import limiter

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

# SlowAPI (Rate Limiting)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: https:; img-src 'self' data: blob: https:;"
    return response

# CORS
# En prod, restrict allow_origins y no usar comodines si se permiten credenciales
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

# NEXUS Observatory — Backend

API FastAPI del sistema de observabilidad de LLMs.

## Requisitos
- Python 3.11+
- Git instalado (para el módulo de análisis de repos)

## Instalación local

```bash
# 1. Crear entorno virtual
python -m venv venv

# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Configurar variables de entorno
cp .env.example .env
# Edita .env y agrega tu OPENAI_API_KEY

# 4. Arrancar
uvicorn app.main:app --reload
```

Abre http://localhost:8000/docs para ver la documentación automática de la API.

## Variables de entorno

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `OPENAI_API_KEY` | ✅ Sí | API key de OpenAI |
| `DATABASE_URL` | No (usa SQLite por defecto) | URL de PostgreSQL para producción |
| `LANGCHAIN_API_KEY` | No | Activa trazas en LangSmith |
| `HELICONE_API_KEY` | No | Activa proxy de costos Helicone |
| `WANDB_API_KEY` | No | Activa métricas en W&B Weave |

## Deploy en Railway

1. Conecta este repositorio a Railway
2. Agrega las variables de entorno en el panel de Railway
3. Railway detecta automáticamente el `Procfile` y despliega

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/chat/` | Chat general con IA |
| POST | `/api/v1/documents/upload` | Subir documento para RAG |
| POST | `/api/v1/documents/query` | Consultar documentos (RAG) |
| POST | `/api/v1/code/review` | Revisar código con IA |
| POST | `/api/v1/code/repo/analyze` | Analizar repositorio GitHub |
| GET  | `/api/v1/metrics/` | Métricas globales del sistema |

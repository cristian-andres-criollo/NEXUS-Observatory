# ==========================================
# Etapa 1: Construcción del Frontend (Node)
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --network-timeout=100000

COPY frontend/ ./
RUN npm run build

# ==========================================
# Etapa 2: Construcción del Monolito (Python)
# ==========================================
FROM python:3.12-slim

WORKDIR /app

# Instalar dependencias del sistema y PostgreSQL
RUN apt-get update && apt-get install -y \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Instalar requerimientos (fusionados backend + gateway)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt asyncpg httpx uvicorn fastapi psycopg2-binary

# Copiar código del backend y gateway
COPY backend/ ./

# Crear directorio estático
RUN mkdir -p /app/static

# Copiar frontend compilado desde la etapa 1
COPY --from=frontend-builder /app/frontend/dist /app/static

# Exponer el puerto unificado
EXPOSE 8000

# Comando para iniciar el monolito
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

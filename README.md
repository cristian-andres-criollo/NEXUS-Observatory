# NEXUS Observatory

> **Plataforma de control y observabilidad de LLMs** — Monitorea el consumo de tokens, costos en pesos colombianos (COP) y conecta cualquier sistema de IA externo a través de su gateway de métricas.

---

## ¿Qué es NEXUS Observatory?

NEXUS Observatory es una plataforma **self-hosted** que te permite:

- 📊 **Visualizar métricas** de uso de tokens, latencia y costos en tiempo real
- 💰 **Controlar el gasto en COP** con TRM actualizada automáticamente
- 🚫 **Kill Switch automático** cuando se supera el presupuesto mensual
- 🔌 **Conectar sistemas de IA externos** (tus propios proyectos, chatbots, agentes) vía API key o proxy
- 👥 **Gestionar múltiples usuarios y proyectos** con planes diferenciados

---

## Requisitos previos

Antes de instalar, asegúrate de tener:

| Herramienta | Versión mínima | Descarga |
|---|---|---|
| **Python** | 3.11+ | https://www.python.org/downloads/ |
| **Node.js** | 18+ | https://nodejs.org/ |
| **Git** | cualquier versión | https://git-scm.com/ |

> **Opcional**: Docker Desktop (solo si prefieres la instalación con contenedores).

---

## Instalación — Opción 1: Desarrollo local (recomendada para empezar)

### Paso 1 — Descomprimir el proyecto

Descomprime el archivo `nexus-observatory.zip` en la carpeta donde quieras instalarlo:

```
nexus-observatory/
├── backend/      ← API en Python (FastAPI)
├── frontend/     ← Interfaz en React (Vite)
├── infra/        ← Configuración de infraestructura
├── docker-compose.yml
└── README.md     ← este archivo
```

---

### Paso 2 — Configurar el Backend

#### 2.1 Entrar a la carpeta del backend

```bash
cd nexus-observatory/backend
```

#### 2.2 Crear el entorno virtual de Python

```bash
# En Windows:
python -m venv venv
venv\Scripts\activate

# En macOS / Linux:
python3 -m venv venv
source venv/bin/activate
```

> Sabrás que está activo porque verás `(venv)` al inicio de tu terminal.

#### 2.3 Instalar las dependencias

```bash
pip install -r requirements.txt
```

> La primera vez puede tardar 2-3 minutos. También descargará automáticamente el modelo de embeddings (~22 MB).

#### 2.4 Crear el archivo de variables de entorno

Copia el archivo de ejemplo y edítalo con tus datos:

```bash
# En Windows:
copy .env.example .env

# En macOS / Linux:
cp .env.example .env
```

Luego abre `.env` con cualquier editor y rellena los valores:

```env
# ── OBLIGATORIO ──────────────────────────────────────────────────
# Obtén tu API key gratis en https://console.groq.com
GROQ_API_KEYS=gsk_tu_key_de_groq_aqui

# ── OPCIONAL (observabilidad avanzada) ───────────────────────────
# LangSmith: https://smith.langchain.com → API Keys
LANGCHAIN_API_KEY=

# W&B Weave: https://wandb.ai → Settings → API Keys
WANDB_API_KEY=

# ── Seguridad ────────────────────────────────────────────────────
# Cambia esto por cualquier cadena aleatoria larga
SECRET_KEY=pon-aqui-una-clave-secreta-de-minimo-32-caracteres
```

#### 2.5 Arrancar el backend

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Deberías ver:
```
🚀 Iniciando NEXUS Observatory Standalone...
[OK] Tablas creadas en la base de datos
[OK] Base de datos inicializada
✅ NEXUS Observatory listo
INFO: Application startup complete.
```

El backend queda disponible en: **http://localhost:8000**  
La documentación de la API está en: **http://localhost:8000/docs**

---

### Paso 3 — Configurar el Frontend

Abre **una terminal nueva** (deja el backend corriendo):

#### 3.1 Entrar a la carpeta del frontend

```bash
cd nexus-observatory/frontend
```

#### 3.2 Instalar dependencias de Node.js

```bash
npm install
```

#### 3.3 Arrancar el servidor de desarrollo

```bash
npm run dev
```

Abre tu navegador en: **http://localhost:5173**

---

### Paso 4 — Iniciar sesión

Al abrir el navegador verás la pantalla de login. Las credenciales por defecto son:

| Rol | Email | Contraseña |
|---|---|---|
| **Admin** | `tovarcristian431@gmail.com` | `Criollo12345*` |
| **Team (prueba)** | `prueba1@nexus.com` | `prueba123` |
| **Community** | `criollo@gmail.com` | `prueba123` |

> ⚠️ **Importante**: Cambia estas contraseñas inmediatamente desde el panel de administración antes de usar el sistema en producción.

---

## Instalación — Opción 2: Docker (todo en un comando)

Si tienes Docker Desktop instalado:

```bash
cd nexus-observatory
docker-compose up -d --build
```

Espera ~2 minutos y accede a:
- **Dashboard**: http://localhost:8000

Para detener todo:
```bash
docker-compose down
```

---

## Conectar un sistema de IA externo

NEXUS puede monitorear cualquier sistema que use LLMs (tus propios proyectos, chatbots, agentes, etc.).

### Paso 1 — Crear un proyecto en NEXUS

Inicia sesión como admin y ejecuta:

```bash
curl -X POST http://localhost:8000/api/v1/admin/projects \
  -H "Authorization: Bearer <tu_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mi Sistema de IA",
    "description": "Chatbot de atención al cliente",
    "plan": "team",
    "budget_cop": 100000
  }'
```

Recibirás una respuesta con tu API key (guárdala, **solo se muestra una vez**):

```json
{
  "id": 1,
  "name": "Mi Sistema de IA",
  "api_key": "nexus_a1b2c3d4e5f6...",
  "budget_cop": 100000
}
```

### Paso 2A — Conexión vía Webhook (más sencilla)

Desde tu sistema, reporta cada llamada a un LLM:

```python
import requests

requests.post("http://localhost:8000/api/v1/ingest",
    headers={"X-Nexus-Key": "nexus_tu_key_aqui"},
    json={
        "model": "llama-3.3-70b-versatile",
        "tokens_in": 450,
        "tokens_out": 312,
        "latency_ms": 1200,
        "module": "mi_funcion"
    }
)
```

### Paso 2B — Conexión vía Proxy (más poderosa)

NEXUS intercepta las llamadas transparentemente. En tu sistema, cambia solo el `.env`:

```env
# Antes (directo al proveedor):
GROQ_API_KEY=gsk_key_real

# Después (a través de NEXUS):
GROQ_BASE_URL=http://localhost:8000/proxy/v1
GROQ_API_KEY=nexus_tu_key_aqui
```

Si tu sistema usa el SDK oficial de Groq, añade una línea:

```python
from groq import Groq
import os

client = Groq(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url=os.getenv("GROQ_BASE_URL", "https://api.groq.com")  # ← esta línea
)
# El resto de tu código no cambia
```

---

## Endpoints principales de la API

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/docs` | Documentación interactiva Swagger |
| `POST` | `/api/v1/auth/login` | Iniciar sesión |
| `GET` | `/api/v1/metrics/` | Métricas generales del sistema |
| `GET` | `/api/v1/admin/dashboard` | Dashboard del administrador |
| `POST` | `/api/v1/admin/projects` | Crear proyecto externo |
| `GET` | `/api/v1/admin/projects` | Listar proyectos externos |
| `POST` | `/api/v1/ingest` | Recibir métricas de sistemas externos |
| `POST` | `/proxy/v1/chat/completions` | Proxy transparente para LLMs |

---

## Estructura del proyecto

```
nexus-observatory/
│
├── backend/
│   ├── app/
│   │   ├── api/routes/       ← Endpoints de la API
│   │   │   ├── auth.py       ← Login y autenticación
│   │   │   ├── admin.py      ← Panel de administración + proyectos externos
│   │   │   ├── metrics.py    ← Métricas de uso
│   │   │   ├── ingest.py     ← Recepción de métricas externas (webhook)
│   │   │   ├── proxy.py      ← Gateway proxy para LLMs
│   │   │   └── export.py     ← Exportación de reportes
│   │   ├── models/           ← Modelos de base de datos (SQLAlchemy)
│   │   ├── services/         ← Lógica de negocio
│   │   └── main.py           ← Punto de entrada
│   ├── .env.example          ← Plantilla de configuración
│   └── requirements.txt      ← Dependencias Python
│
├── frontend/
│   ├── src/
│   │   ├── pages/            ← Dashboard y FinOps
│   │   ├── components/       ← Componentes reutilizables
│   │   └── hooks/            ← Hooks de React para datos
│   └── package.json
│
├── docker-compose.yml        ← Orquestación Docker
└── README.md                 ← Este archivo
```

---

## Solución de problemas frecuentes

### ❌ `ModuleNotFoundError` al arrancar el backend
```bash
# Asegúrate de que el venv está activo
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### ❌ El frontend no conecta con el backend
Verifica que en `frontend/.env` (o directamente en el código) la URL del backend sea correcta. El backend debe estar corriendo en el puerto 8000.

### ❌ `GROQ_API_KEYS` está vacío / error de autenticación
Obtén una API key gratuita en https://console.groq.com y agrégala al archivo `backend/.env`.

### ❌ La base de datos no se crea
Asegúrate de ejecutar uvicorn desde **dentro** de la carpeta `backend/`, no desde la raíz del proyecto.

---

## Soporte

- **Documentación API**: http://localhost:8000/docs (cuando el backend esté corriendo)
- **Desarrollado por**: Shirokage Devs
- **Versión**: 1.0.0

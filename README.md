# NEXUS Observatory — Standalone

Plataforma unificada de observabilidad para Modelos de Lenguaje (LLMs) nativa, con procesamiento de datos interno para cumplir normativas de privacidad de datos (Ley 1581 de Colombia). 

NEXUS ahora incluye todo su ecosistema de observabilidad en contenedores Docker locales:
- **Nexus Monolith**: Frontend en React y Backend en FastAPI unidos.
- **Langfuse**: Plataforma de trazas, árboles y evaluación de LLMs.
- **LiteLLM**: Proxy de Inteligencia Artificial para el control financiero (FinOps) y caché.
- **PostgreSQL**: Base de datos de alta velocidad unificada para telemetría.

---

## 🚀 Cómo Ejecutar el Proyecto

Tienes dos formas de levantar este proyecto. **Recomendamos fuertemente la Opción 1** para tener la experiencia unificada, pero la Opción 2 es útil si estás programando activamente en el código.

### Opción 1: Todo en Docker (Recomendada)
Esta opción arranca todo el ecosistema (Frontend, Backend, Proxy, Base de Datos y Telemetría) con un solo comando.

1. Abre tu terminal en esta carpeta raíz.
2. Ejecuta:
   ```bash
   docker-compose up -d --build
   ```
3. Espera a que los contenedores inicien y visita:
   - **Dashboard Principal (NEXUS):** http://localhost:8000
   - **Panel de Trazas (Langfuse):** http://localhost:3030
   - **Panel FinOps (LiteLLM):** http://localhost:4000

Para detener todo, simplemente ejecuta `docker-compose down`.

---

### Opción 2: Desarrollo Local (Terminales Separadas)
Si quieres desarrollar y editar código de React o Python viendo los cambios en tiempo real ("Hot Reload"), puedes levantar solo las herramientas de base de datos en Docker y correr el código fuente en tus terminales.

**Paso 1: Encender SOLO las herramientas de telemetría en Docker**
```bash
docker-compose up -d postgres litellm langfuse-server
```
*(Esto deja el puerto 8000 libre para tu entorno local)*

**Paso 2: Levantar el Backend (Python)**
Abre una terminal nueva:
```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
*(Tu backend local ahora se conectará automáticamente a las herramientas de Docker gracias a las variables en `backend/.env`)*

**Paso 3: Levantar el Frontend (React)**
Abre otra terminal nueva:
```bash
cd frontend
npm run dev
```
*(Tu navegador abrirá automáticamente http://localhost:5173 para el desarrollo del frontend).*

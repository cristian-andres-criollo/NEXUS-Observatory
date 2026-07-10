# NEXUS Observatory — Backend

Este directorio contiene la API FastAPI del sistema de observabilidad.
Para instrucciones detalladas sobre cómo arrancar el proyecto completo (Docker o Desarrollo Local), por favor revisa el **[README principal](../README.md)** en la carpeta raíz.

## Variables de entorno (.env)

El archivo `.env` está preconfigurado para correr el backend en tu terminal local conectándose a los contenedores Docker de telemetría (PostgreSQL, Langfuse y LiteLLM).

| Variable | Descripción |
|----------|-------------|
| `GROQ_API_KEYS` | (Opcional) Las llaves ya están inyectadas a nivel de proxy, pero pueden configurarse aquí si omites LiteLLM. |
| `DATABASE_URL` | Usa SQLite (`sqlite:///./nexus.db`) para gestionar los usuarios locales de la interfaz. |
| `FINOPS_DATABASE_URL` | Conexión a PostgreSQL en `localhost:5432` para guardar la telemetría real. |
| `LITELLM_URL` | Conexión al Proxy de IA en `http://localhost:4000`. |

## 🛠️ Instalación y Ejecución Local

Si deseas correr el backend de forma local (fuera de Docker) para desarrollo:

1. **Crear y activar el entorno virtual:**
   ```bash
   python -m venv venv
   # En Windows:
   venv\Scripts\activate
   # En macOS/Linux:
   source venv/bin/activate
   ```

2. **Instalar dependencias:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Arrancar el servidor:**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

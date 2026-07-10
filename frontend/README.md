# NEXUS Observatory — Frontend

Interfaz React del sistema de observabilidad.
Para instrucciones detalladas sobre cómo arrancar el proyecto completo (Docker o Desarrollo Local), por favor revisa el **[README principal](../README.md)** en la carpeta raíz.

## Variables de entorno (.env)

El archivo `.env` del frontend solo necesita esta variable:
```
VITE_API_URL=/api/v1
```

Esto funciona perfectamente tanto dentro del Monolito de Docker como en desarrollo local, ya que en el archivo `vite.config.ts` hay un proxy configurado hacia `http://127.0.0.1:8000`.

## Módulos Principales

| Ruta | Módulo | Descripción |
|------|--------|-------------|
| `/` | Dashboard | Tablero unificado con métricas locales en tiempo real. |
| `/chat` | Asistente | Chat con IA, monitoreado por las herramientas de observabilidad. |
| `/rag` | Documentos | Interfaz para cargar y procesar documentos. |
| `/review` | Code Review | Revisión de código automatizada. |
| `/repo` | Repo Agent | Agente multi-paso que analiza repositorios GitHub. |

## 🛠️ Instalación y Ejecución Local

Si deseas correr el frontend de forma local para desarrollo:

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Arrancar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

# NEXUS Observatory — Frontend

Interfaz React del sistema de observabilidad de LLMs.

## Requisitos
- Node.js 18+
- Backend corriendo en `http://localhost:8000`

## Instalación y arranque

```bash
npm install
npm run dev
```

Abre http://localhost:5173

## Variables de entorno

Copia `.env.example` a `.env` y configura:

```
VITE_API_URL=https://tu-backend.railway.app/api/v1
```

En desarrollo local no necesitas esta variable (Vite hace proxy automático).

## Deploy en Netlify

1. Conecta este repo a Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Agrega la variable de entorno `VITE_API_URL` apuntando a tu Railway backend

## Módulos

| Ruta | Módulo | Descripción |
|------|--------|-------------|
| `/` | Dashboard | Métricas globales en tiempo real |
| `/chat` | Asistente | Chat con IA, monitoreado por las 4 herramientas |
| `/rag` | Documentos | RAG con detección de alucinaciones (Phoenix) |
| `/review` | Code Review | Revisión de código con LLM-as-judge (LangSmith) |
| `/repo` | Repo Agent | Agente multi-paso que analiza repositorios GitHub |

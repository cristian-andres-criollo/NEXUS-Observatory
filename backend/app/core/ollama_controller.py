import subprocess
import httpx
import logging
import asyncio
from app.core.config import settings

logger = logging.getLogger(__name__)

async def check_ollama_status(base_url: str = "http://localhost:11434") -> str:
    """
    Realiza un GET a la ruta base de Ollama para verificar si está corriendo.
    Retorna 'running' o 'stopped'.
    """
    try:
        # El endpoint principal retorna "Ollama is running" (texto plano)
        async with httpx.AsyncClient(timeout=2.0) as client:
            # Ngrok requiere este header para saltarse la página de advertencia
            headers = {"ngrok-skip-browser-warning": "true"}
            resp = await client.get(base_url, headers=headers)
            if resp.status_code == 200 and "Ollama is running" in resp.text:
                return "running"
            return "stopped"
    except Exception as e:
        logger.debug(f"Ollama no responde o está apagado: {e}")
        return "stopped"

def start_ollama_server() -> bool:
    """
    Intenta ejecutar `ollama serve` en un proceso desacoplado.
    Funciona principalmente en entornos donde `ollama` está en el PATH.
    """
    try:
        # Usamos CREATE_NO_WINDOW en Windows para que no salte una terminal negra en la pantalla del usuario
        import platform
        
        creationflags = 0
        if platform.system() == "Windows":
            creationflags = subprocess.CREATE_NO_WINDOW
            
        # Popen permite que el subproceso corra en background sin bloquear a FastAPI
        process = subprocess.Popen(
            ["ollama", "serve"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creationflags,
            start_new_session=True
        )
        logger.info(f"Ollama iniciado con PID: {process.pid}")
        return True
    except Exception as e:
        logger.error(f"Fallo al intentar iniciar ollama serve: {e}")
        return False

def stop_ollama_server() -> bool:
    """
    Intenta detener el proceso de Ollama local.
    """
    import platform
    try:
        if platform.system() == "Windows":
            subprocess.run(["taskkill", "/F", "/IM", "ollama.exe"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            subprocess.run(["pkill", "-f", "ollama serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except Exception as e:
        logger.error(f"Fallo al detener ollama: {e}")
        return False

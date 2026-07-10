import httpx
import logging
import asyncio
from datetime import datetime
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.system import SystemSettings

logger = logging.getLogger(__name__)

async def fetch_trm_and_prices():
    """
    Consulta periódicamente la TRM del dólar a COP y los precios actualizados
    de los diferentes proveedores de IA.
    """
    logger.info("Iniciando consulta programada de TRM y precios de IA...")
    
    db: Session = SessionLocal()
    try:
        # Obtener configuración actual
        settings = db.query(SystemSettings).first()
        if not settings:
            settings = SystemSettings()
            db.add(settings)
            db.commit()
            db.refresh(settings)

        async with httpx.AsyncClient(timeout=10.0) as client:
            # 1. Consultar TRM Diaria (usando API pública de tasas de cambio)
            try:
                # Usamos open.er-api.com como endpoint público gratuito y confiable
                trm_response = await client.get("https://open.er-api.com/v6/latest/USD")
                if trm_response.status_code == 200:
                    data = trm_response.json()
                    cop_rate = data.get("rates", {}).get("COP")
                    if cop_rate:
                        settings.trm_usd_cop = float(cop_rate)
                        logger.info(f"TRM actualizada exitosamente: 1 USD = {cop_rate} COP")
            except Exception as e:
                logger.error(f"Error consultando TRM: {e}")

            # 2. Consultar Precios de Tokens de IA
            try:
                # Simularemos los precios actualizados a día de hoy
                simulated_prices = {
                    "groq": 0.69,       # Costo promedio Groq
                    "anthropic": 15.0,  # Claude 3.5 Sonnet
                    "openai": 10.0,     # GPT-4o
                    "google": 7.0       # Gemini 1.5 Pro
                }
                
                settings.groq_cost_per_million = simulated_prices["groq"]
                settings.anthropic_cost_per_million = simulated_prices["anthropic"]
                settings.openai_cost_per_million = simulated_prices["openai"]
                settings.google_cost_per_million = simulated_prices["google"]
                
                logger.info("Precios de tokens de IA actualizados exitosamente.")
            except Exception as e:
                logger.error(f"Error consultando precios de IA: {e}")

            # Guardar cambios
            db.commit()
            
    except Exception as e:
        logger.error(f"Error en el scheduler_service: {e}")
    finally:
        db.close()

async def start_scheduler():
    """
    Inicia el scheduler que ejecuta las tareas en segundo plano.
    Se llama desde el lifespan de FastAPI.
    """
    logger.info("Arrancando Background Scheduler...")
    
    # Ejecutamos la primera vez inmediatamente al arrancar
    await fetch_trm_and_prices()
    
    # Bucle infinito para consultar (ej: cada 24 horas = 86400 segundos)
    while True:
        await asyncio.sleep(86400) # Dormir 24 horas
        
        # Omitir fines de semana (5=Sábado, 6=Domingo)
        if datetime.now().weekday() not in [5, 6]:
            await fetch_trm_and_prices()

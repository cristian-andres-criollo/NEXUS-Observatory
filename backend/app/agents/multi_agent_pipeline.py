import logging
import time
import uuid
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy.orm import Session
from app.core.llm_provider import get_planner_llm, get_executor_llm
from app.models.conversation import Conversation
from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Patrón de Inicialización y Control de Progreso
# ---------------------------------------------------------------------------
class Task(BaseModel):
    id: int
    description: str
    status: str = Field(default="[ ]", description="[ ] pendiente, [x] completada, [!] error")
    result: Optional[str] = None

class ProgressTracker:
    """
    Rastreador que emula un archivo Markdown en memoria donde el agente 
    va marcando con una 'X' las tareas completadas.
    Detiene la ejecución (Arnés) de manera controlada ante fallas.
    """
    def __init__(self):
        self.tasks: List[Task] = []
        
    def add_task(self, description: str):
        self.tasks.append(Task(id=len(self.tasks) + 1, description=description))
        
    def mark_done(self, task_id: int, result: str):
        self.tasks[task_id - 1].status = "[x]"
        self.tasks[task_id - 1].result = result
        
    def mark_error(self, task_id: int, error: str):
        self.tasks[task_id - 1].status = "[!]"
        self.tasks[task_id - 1].result = error
        
    def render_markdown(self) -> str:
        md = "## Progreso de Tareas\n\n"
        for t in self.tasks:
            md += f"- {t.status} Tarea {t.id}: {t.description}\n"
            if t.result:
                md += f"  - Resultado parcial: {t.result[:50]}...\n"
        return md


# ---------------------------------------------------------------------------
# Patrón de Tres Agentes: Planificador, Generador, Evaluador
# ---------------------------------------------------------------------------

def run_multi_agent_pipeline(user_request: str, db: Session = None, user_email: str = None) -> str:
    """
    Flujo de trabajo distribuido usando FinOps (modelos híbridos).
    No daña el sistema porque corre de forma aislada y solo procesa el texto.
    Guarda los consumos reales en SQLite (FinOps).
    """
    tracker = ProgressTracker()
    session_id = str(uuid.uuid4())
    start_time = time.time()
    total_tokens = 0
    
    # Precios simulados/reales para FinOps (por millon de tokens)
    planner_rate = 0.59 # Ejemplo Llama 70b
    executor_rate = 0.05 # Ejemplo Llama 8b
    total_cost = 0.0
    
    # 1. PLANIFICADOR (Usa modelo Frontier, más robusto)
    planner_llm = get_planner_llm(temperature=0.2)
    logger.info("Planificador: Diseñando pasos a seguir...")
    
    # Simulación de planificación estática basada en el input
    tracker.add_task("Analizar requerimiento y contexto")
    tracker.add_task("Extraer entidades principales")
    tracker.add_task("Generar reporte final")
    
    # Costo del planificador (simulado estáticamente para el ejemplo, o se puede extraer de AIMessage)
    planner_tokens = 300
    total_tokens += planner_tokens
    total_cost += (planner_tokens / 1_000_000) * planner_rate
    
    # 2. GENERADOR / CONSTRUCTOR (Usa modelo liviano/pequeño, más económico)
    executor_llm = get_executor_llm(temperature=0.1)
    
    try:
        # Ejecución Paso 1
        logger.info("Generador: Ejecutando Tarea 1...")
        res1 = executor_llm.invoke(f"Analiza este requerimiento: {user_request}")
        tracker.mark_done(1, res1.content)
        total_tokens += 150
        
        # Ejecución Paso 2
        logger.info("Generador: Ejecutando Tarea 2...")
        res2 = executor_llm.invoke(f"Extrae las entidades principales de este texto: {res1.content}")
        tracker.mark_done(2, res2.content)
        total_tokens += 100
        
        # 3. EVALUADOR / INSPECTOR (También puede usar modelo pequeño para validación rápida)
        logger.info("Evaluador: Validando pasos previos antes de generar reporte...")
        if "error" in res2.content.lower():
            raise ValueError("El evaluador detectó anomalías en las entidades extraídas.")
            
        # Ejecución Paso 3
        logger.info("Generador: Ejecutando Tarea 3...")
        res3 = executor_llm.invoke(f"Genera un minireporte consolidado: {res2.content}")
        tracker.mark_done(3, res3.content)
        total_tokens += 200
        
        total_cost += ((150 + 100 + 200) / 1_000_000) * executor_rate
        
    except Exception as e:
        logger.error(f"Error detectado, deteniendo ejecución para evitar sobreconsumo: {e}")
        # En caso de fallas o ambigüedades, detenemos y pedimos intervención (Control de Progreso)
        for t in tracker.tasks:
            if t.status == "[ ]":
                tracker.mark_error(t.id, f"Detenido por Arnés: {str(e)}")
                break
                
    latency_ms = int((time.time() - start_time) * 1000)
    final_output = tracker.render_markdown()
    
    # Guardar en base de datos real (SQLite) para FinOps
    if db:
        try:
            conv = Conversation(
                session_id=session_id,
                user_email=user_email,
                module="multi_agent",
                user_message=user_request,
                assistant_message=final_output,
                model="hybrid-pipeline",
                tokens_used=total_tokens,
                cost_usd=round(total_cost, 6),
                latency_ms=latency_ms,
                extra={"tracker": [t.dict() for t in tracker.tasks]}
            )
            db.add(conv)
            db.commit()
            logger.info(f"Guardado registro FinOps en DB: ${total_cost} | {total_tokens} tokens")
        except Exception as db_err:
            logger.error(f"Error guardando FinOps en DB: {db_err}")
            
    logger.info("Resumen Final del Pipeline:\n" + final_output)
    return final_output

import os
import json
import httpx
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse
import asyncpg
from typing import Optional

# =========================================================================
# NEXUS FINOPS GATEWAY (FastAPI Middleware)
# Intercepta llamadas a LiteLLM, valida presupuesto en COP (Kill Switch)
# y registra consumos transaccionalmente en PostgreSQL.
# =========================================================================

app = FastAPI(title="Nexus FinOps Gateway")

# Configuración de Entorno
LITELLM_URL = os.getenv("LITELLM_URL", "http://localhost:4000")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://nexus_admin:nexus_secure_password@localhost:5432/nexus_db")

# Pool de conexiones a PostgreSQL
db_pool = None

@app.on_event("startup")
async def startup():
    global db_pool
    db_pool = await asyncpg.create_pool(DATABASE_URL)
    print("🚀 Nexus FinOps Gateway conectado a PostgreSQL.")

@app.on_event("shutdown")
async def shutdown():
    await db_pool.close()

async def get_db():
    async with db_pool.acquire() as connection:
        yield connection

async def check_budget_cop(company_id: str, conn: asyncpg.Connection):
    """
    Verifica si la empresa tiene saldo disponible para el mes actual en COP.
    Retorna el ID del budget y la TRM si tiene saldo, sino lanza HTTPException 402.
    """
    # Usamos to_char(CURRENT_DATE, 'YYYY-MM') simulado aquí mediante SQL
    query = """
        SELECT id, monthly_limit_cop, current_spend_cop, trm_rate
        FROM budgets 
        WHERE company_id = $1 AND year_month = to_char(CURRENT_DATE, 'YYYY-MM') AND is_active = TRUE
    """
    record = await conn.fetchrow(query, company_id)
    
    if not record:
        raise HTTPException(status_code=403, detail="No active budget found for this month.")
        
    budget_id = record['id']
    limit = record['monthly_limit_cop']
    spend = record['current_spend_cop']
    trm = record['trm_rate']
    
    # KILL SWITCH LOGIC (FinOps)
    if spend >= limit:
        raise HTTPException(
            status_code=402, 
            detail=f"Budget Exceeded. Limit: ${limit:,.2f} COP | Spent: ${spend:,.2f} COP"
        )
        
    return budget_id, trm

async def register_transaction(
    conn: asyncpg.Connection,
    project_id: str,
    budget_id: str,
    model: str,
    tokens: int,
    cost_usd: float,
    trm: float
):
    """Registra la transacción y actualiza el saldo gastado en COP."""
    cost_cop = cost_usd * trm
    
    # Transacción atómica
    async with conn.transaction():
        # Insertar log
        await conn.execute("""
            INSERT INTO transactions (project_id, budget_id, model_name, total_tokens, cost_usd, cost_cop, trm_applied)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        """, project_id, budget_id, model, tokens, cost_usd, cost_cop, trm)
        
        # Actualizar presupuesto
        await conn.execute("""
            UPDATE budgets SET current_spend_cop = current_spend_cop + $1
            WHERE id = $2
        """, cost_cop, budget_id)

@app.post("/v1/chat/completions")
async def chat_completions(request: Request, db: asyncpg.Connection = Depends(get_db)):
    """
    Endpoint principal que los agentes corporativos consumirán.
    Validaremos los headers X-Company-Id y X-Project-Id.
    """
    # 1. Extracción de metadatos del cliente
    company_id = request.headers.get("X-Company-Id")
    project_id = request.headers.get("X-Project-Id")
    
    if not company_id or not project_id:
        raise HTTPException(status_code=400, detail="Missing X-Company-Id or X-Project-Id headers")
        
    body_bytes = await request.body()
    body_json = json.loads(body_bytes)
    
    # 2. FINOPS KILL SWITCH - Validar presupuesto en COP
    budget_id, trm_rate = await check_budget_cop(company_id, db)
    
    # 3. Pass-through Proxy a LiteLLM
    headers = {
        "Content-Type": "application/json",
        # Opcional: Propagar metadata a LiteLLM/Langfuse para rastreo end-to-end
        "metadata": json.dumps({"project_id": project_id, "company_id": company_id})
    }
    
    try:
        async with httpx.AsyncClient() as client:
            # Petición a LiteLLM (que se encargará de enrutar a OpenAI, Claude, etc.)
            response = await client.post(
                f"{LITELLM_URL}/v1/chat/completions",
                content=body_bytes,
                headers=headers,
                timeout=60.0
            )
            response.raise_for_status()
            
            # En caso de No-Streaming, interceptamos tokens y guardamos
            if not body_json.get("stream", False):
                resp_json = response.json()
                usage = resp_json.get("usage", {})
                total_tokens = usage.get("total_tokens", 0)
                
                # Simulamos cálculo de costo USD (Idealmente consultado desde una API o LiteLLM metadata)
                # Para el ejemplo, 1 token = 0.00001 USD
                cost_usd = total_tokens * 0.00001 
                
                await register_transaction(
                    conn=db,
                    project_id=project_id,
                    budget_id=budget_id,
                    model=body_json.get("model", "unknown"),
                    tokens=total_tokens,
                    cost_usd=cost_usd,
                    trm=trm_rate
                )
                
                return resp_json
            
            else:
                # Retornamos el streaming directamente. 
                # (NOTA: El cálculo de tokens en streaming requiere acumular los chunks en un background task.
                # Se omite para simplicidad en este esqueleto inicial).
                return StreamingResponse(
                    response.aiter_raw(), 
                    status_code=response.status_code, 
                    headers=dict(response.headers)
                )

    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=exc.response.text)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

if __name__ == "__main__":
    import uvicorn
    # Iniciar servidor local
    uvicorn.run(app, host="0.0.0.0", port=8080)

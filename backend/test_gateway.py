import httpx
import asyncio
import json

async def test_gateway():
    print("=== PROBANDO NEXUS FINOPS GATEWAY ===")
    
    # IDs de prueba que insertamos en schema.sql
    COMPANY_ID = "11111111-1111-1111-1111-111111111111" # Acme Corp
    PROJECT_ID = "22222222-2222-2222-2222-222222222222" # Asistente RRHH
    
    headers = {
        "X-Company-Id": COMPANY_ID,
        "X-Project-Id": PROJECT_ID,
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "gpt-3.5-turbo",
        "messages": [
            {"role": "user", "content": "¿Cuál es el sentido de la vida según la IA?"}
        ]
    }
    
    print(f"Enviando petición a http://localhost:8080 con la empresa {COMPANY_ID}...\n")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "http://localhost:8080/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30.0
            )
            
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                print("✅ ÉXITO: El Gateway aprobó el saldo y retornó la respuesta del modelo:")
                print(json.dumps(response.json(), indent=2, ensure_ascii=False))
            elif response.status_code == 402:
                print("⛔ KILL SWITCH ACTIVADO (402 Payment Required):")
                print(response.json())
            else:
                print(f"⚠️ ERROR INESPERADO: {response.text}")
                
        except Exception as e:
            print(f"❌ Error de conexión: {e}")

if __name__ == "__main__":
    asyncio.run(test_gateway())

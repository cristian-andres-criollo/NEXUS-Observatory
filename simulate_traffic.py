import os
import sys
import time
import requests

# Añadir el backend al PYTHONPATH para poder importar
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
from app.db.database import get_db
from app.models.external_project import ExternalProject, generate_api_key, hash_api_key

def main():
    # 1. Obtener la sesión de base de datos
    db = next(get_db())
    
    # Buscar el primer proyecto activo
    project = db.query(ExternalProject).filter(ExternalProject.is_active == True).first()
    if not project:
        print("No hay proyectos activos para simular tráfico.")
        return
    
    print(f"Usando proyecto: {project.name} (Presupuesto: {project.budget_cop} COP)")
    
    # 2. Generar nueva API key temporal para la prueba
    raw_key = generate_api_key()
    project.api_key_hash = hash_api_key(raw_key)
    project.api_key_prefix = raw_key[:8]
    db.commit()
    print(f"API Key reseteada temporalmente para la prueba: {raw_key}")
    
    # 3. Hacer múltiples peticiones a la API proxy
    url = "http://localhost:8000/proxy/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {raw_key}",
        "Content-Type": "application/json"
    }
    # Un prompt grande que consuma tokens para llegar rápido al límite
    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "user", "content": "Escribe una historia muy detallada y larga, de unas 1000 palabras, sobre el universo, las galaxias y la vida. Asegúrate de ser lo más descriptivo posible. (Prueba de carga extrema)"}
        ]
    }
    
    print("\nIniciando simulación de tráfico continuo...")
    for i in range(1, 15):
        print(f"Petición {i}...")
        try:
            # Usar request síncrono, puede demorar un poco la respuesta del LLM
            response = requests.post(url, json=payload, headers=headers)
            if response.status_code == 200:
                print(f"  -> Éxito: Status 200 OK")
                print(f"  -> Respuesta recibida...")
            elif response.status_code == 402:
                print(f"  -> BLOQUEO DE NEXUS (402 Payment Required)")
                print(f"  -> Detalle: {response.json()}")
                print("  -> ¡El Kill Switch funciona correctamente y ha protegido el presupuesto!")
                break
            else:
                print(f"  -> Fallo inesperado: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"  -> Error de conexión: {e}")
        time.sleep(1)
        
    print("\nSimulación terminada.")

if __name__ == "__main__":
    main()

import sqlite3
import os

db_path = "c:/Users/cristian andres/OneDrive/Documentos/investigacion/Investigacion-1-Nexus-Observatory/nexus-observatory/backend/nexus.db"

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE system_settings ADD COLUMN llm_provider VARCHAR DEFAULT 'groq'")
        cursor.execute("ALTER TABLE system_settings ADD COLUMN ollama_base_url VARCHAR DEFAULT 'http://localhost:11434'")
        cursor.execute("ALTER TABLE system_settings ADD COLUMN ollama_model VARCHAR DEFAULT 'llama3'")
        conn.commit()
        print("Columnas añadidas con éxito.")
    except Exception as e:
        print("Error añadiendo columnas (quizá ya existen):", e)
    finally:
        conn.close()
else:
    print("No se encontró la base de datos.")

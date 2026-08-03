import os
from locust import HttpUser, task, between
from uuid import uuid4

class ProxyUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        # Para que locust funcione, debes tener un API KEY válido de un proyecto de prueba.
        # Se puede inyectar vía variables de entorno al lanzar locust.
        self.api_key = os.getenv("TEST_API_KEY", "nexus_missing_key")
        
    @task
    def test_chat_completion(self):
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "X-Nexus-End-User-ID": f"locust_user_{uuid4().hex[:6]}@test.com"
        }
        payload = {
            "model": "llama-3.1-8b-instant",
            "messages": [
                {"role": "user", "content": "Escribe un poema sobre el estrés de los servidores."}
            ]
        }
        
        with self.client.post("/proxy/v1/chat/completions", headers=headers, json=payload, catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code in [403, 401]:
                # Si es 403, el límite FinOps está actuando, lo contamos como success técnico si queríamos probar eso
                response.failure(f"FinOps rejection: {response.text}")
            else:
                response.failure(f"Error {response.status_code}: {response.text}")

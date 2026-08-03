import requests
import json
import time

def test_proxy(project_id, user_email):
    url = "http://localhost:8000/proxy/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer nexus_cd86efd761cf5133d2abb88db63ad30c", # from context
        "X-Nexus-End-User-ID": user_email
    }
    
    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "user", "content": "Escribe un poema corto sobre el espacio"}
        ],
        "max_tokens": 500
    }
    
    print(f"Testing {user_email}...")
    try:
        response = requests.post(url, headers=headers, json=payload)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print(f"Success! Answer length: {len(response.json()['choices'][0]['message']['content'])}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_proxy(2, "usuario1@test.com")
    time.sleep(1)
    test_proxy(2, "usuario2@test.com")
    time.sleep(1)
    test_proxy(2, "admin@nexus.com")

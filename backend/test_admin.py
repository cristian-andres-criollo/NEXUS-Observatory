import sqlite3
import requests
import bcrypt
import json

# Change password in DB to 'admin123'
new_pwd = b'admin123'
salt = bcrypt.gensalt()
hashed = bcrypt.hashpw(new_pwd, salt).decode('utf-8')

conn = sqlite3.connect('nexus.db')
conn.execute("UPDATE users SET hashed_password = ? WHERE email = 'admin@nexus.test'", (hashed,))
conn.commit()

# Now login
login_data = {
    'username': 'admin@nexus.test',
    'password': 'admin123'
}
r_login = requests.post('http://127.0.0.1:8000/api/v1/auth/login', data=login_data)
if r_login.status_code != 200:
    print("Failed to login:", r_login.text)
    exit(1)

token = r_login.json()['access_token']
print("Logueado como admin@nexus.test!")

# Now test the chat endpoint
headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}
chat_data = {
    'message': 'Hola, dime en una oración corta que el backend funciona y estás vivo.',
    'session_id': 'test_admin_script'
}
print("Enviando mensaje al LLM...")
r_chat = requests.post('http://127.0.0.1:8000/api/v1/chat/', headers=headers, json=chat_data)
print("Código HTTP:", r_chat.status_code)
try:
    resp = r_chat.json()
    print("Respuesta de IA:", resp.get("response", "No content"))
    print("Costo (USD):", resp.get("cost_usd"))
    print("Latencia (ms):", resp.get("latency_ms"))
except Exception as e:
    print(r_chat.text)

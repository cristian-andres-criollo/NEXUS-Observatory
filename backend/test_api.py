import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        # Primero login
        data = {'username': 'admin@nexus.com', 'password': 'adminpassword'}
        login_res = await client.post('http://127.0.0.1:8000/api/v1/auth/login', data=data)
        print("Login:", login_res.status_code)
        
        token = login_res.json().get('access_token')
        
        # Luego get dashboard
        res = await client.get('http://127.0.0.1:8000/api/v1/admin/dashboard', headers={'Authorization': f'Bearer {token}'})
        print("Dashboard:", res.status_code)
        print(res.text)

asyncio.run(main())

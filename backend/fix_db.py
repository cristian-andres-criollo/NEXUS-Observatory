from app.db.finops_db import FinopsSessionLocal
from sqlalchemy import text

def fix():
    db = FinopsSessionLocal()
    try:
        cid = db.execute(text("SELECT id FROM companies LIMIT 1")).scalar()
        if not cid:
            return
        
        # We don't know the exact email, but we can update all NULL user_id transactions 
        # to the admin user, or just delete them so they don't cause confusion. 
        # Let's just create admin@nexus.com
        uid = db.execute(text("INSERT INTO users (company_id, email) VALUES (:cid, 'admin@nexus.com') ON CONFLICT (email) DO UPDATE SET email=EXCLUDED.email RETURNING id"), {"cid": cid}).scalar()
        
        db.execute(text("UPDATE transactions SET user_id = :uid WHERE user_id IS NULL"), {"uid": uid})
        db.commit()
        print("Fixed transactions!")
    except Exception as e:
        print("Error:", e)
    finally:
        db.close()

if __name__ == "__main__":
    fix()

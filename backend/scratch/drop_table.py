import sqlite3

def fix_db():
    conn = sqlite3.connect('nexus.db')
    cursor = conn.cursor()
    cursor.execute("DROP TABLE IF EXISTS agent_user_limits")
    conn.commit()
    conn.close()
    print("Table dropped successfully!")

if __name__ == "__main__":
    fix_db()

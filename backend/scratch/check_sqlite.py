import sqlite3
import pprint

def check_db():
    conn = sqlite3.connect('nexus.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM agent_user_limits")
    rows = cursor.fetchall()
    print("--- agent_user_limits ---")
    for row in rows:
        print(dict(row))
    print("--- PRAGMA table_info ---")
    cursor.execute("PRAGMA table_info(agent_user_limits)")
    for row in cursor.fetchall():
        print(dict(row))
    conn.close()

if __name__ == '__main__':
    check_db()

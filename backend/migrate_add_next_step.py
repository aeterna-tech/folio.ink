"""
Миграция: добавление поля next_step в таблицу entry.
Одноразовый скрипт — запускается после обновления кода.
"""
import sqlite3
from app.database import get_db_path


def migrate():
    db_path = get_db_path()
    print(f"DB path: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(entry)")
    columns = [col[1] for col in cursor.fetchall()]

    if 'next_step' in columns:
        print("Column next_step already exists, skip.")
    else:
        cursor.execute("ALTER TABLE entry ADD COLUMN next_step TEXT")
        conn.commit()
        print("Column next_step added.")

    conn.close()


if __name__ == "__main__":
    migrate()

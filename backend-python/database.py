import os
from urllib.parse import quote_plus
import json

from dotenv import load_dotenv
import psycopg2
import psycopg2.extras
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.engine import make_url


load_dotenv()

def normalize_database_url(url: str) -> str:
    if not url:
        return url
    url = url.strip()
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url

raw_database_url = os.getenv("DATABASE_URL")
DATABASE_URL = normalize_database_url(raw_database_url)

if not DATABASE_URL:
    user = os.getenv("DB_USER") or os.getenv("user") or "postgres"
    password = os.getenv("DB_PASSWORD") or os.getenv("password") or ""
    host = os.getenv("DB_HOST") or os.getenv("host") or "localhost"
    port = os.getenv("DB_PORT") or os.getenv("port") or "5432"
    db = os.getenv("DB_NAME") or os.getenv("database") or "postgres"
    driver = os.getenv("DB_DRIVER") or "psycopg2"
    password_quoted = quote_plus(password)
    DATABASE_URL = f"postgresql+{driver}://{user}:{password_quoted}@{host}:{port}/{db}?sslmode=disable"

db_engine = create_engine(DATABASE_URL)
DBSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
DBBase = declarative_base()

try:
    db_url_obj = make_url(DATABASE_URL)
    db_username = db_url_obj.username or os.getenv("DB_USER") or os.getenv("user")
    db_password = db_url_obj.password or os.getenv("DB_PASSWORD") or os.getenv("password")
    db_host = db_url_obj.host or os.getenv("DB_HOST") or os.getenv("host")
    db_port = db_url_obj.port or os.getenv("DB_PORT") or os.getenv("port")
    db_name = db_url_obj.database or os.getenv("DB_NAME") or os.getenv("database")
except Exception:
    db_username = os.getenv("DB_USER") or os.getenv("user")
    db_password = os.getenv("DB_PASSWORD") or os.getenv("password")
    db_host = os.getenv("DB_HOST") or os.getenv("host")
    db_port = os.getenv("DB_PORT") or os.getenv("port")
    db_name = os.getenv("DB_NAME") or os.getenv("database")


def connect_postgres():
    conn = psycopg2.connect(
        host=db_host,
        database=db_name,
        user=db_username,
        password=db_password,
        port=db_port,
    )
    try:
        conn.autocommit = True
    except Exception:
        pass
    return conn


def load_whatsapp_messages(limit: int | None = None) -> list:
    conn = None
    try:
        conn = connect_postgres()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        sql = "SELECT * FROM bot.whatsapp"
        if limit is not None:
            sql += " LIMIT %s"
            cur.execute(sql, (limit,))
        else:
            cur.execute(sql)
        rows = cur.fetchall()
        cur.close()
        return [dict(r) for r in rows]
    finally:
        if conn:
            conn.close()


def load_chat_history_by_session(session_id: str, limit: int | None = None) -> list:
   
    conn = None
    try:
        conn = connect_postgres()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        sql = "SELECT id, session_id, message FROM public.n8n_chat_histories WHERE session_id = %s ORDER BY id ASC"
        if limit is not None:
            sql = sql.replace("ORDER BY id ASC", "ORDER BY id ASC LIMIT %s")
            cur.execute(sql, (session_id, limit))
        else:
            cur.execute(sql, (session_id,))
        rows = cur.fetchall()
        result = []
        for r in rows:
            row = dict(r)
            msg = row.get("message")
            if isinstance(msg, str):
                try:
                    row["message"] = json.loads(msg)
                except Exception:
                    row["message"] = msg
            result.append(row)
        cur.close()
        return result
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    try:
        rows = load_whatsapp_messages()
        print(json.dumps(rows, default=str, ensure_ascii=False, indent=2))
    except Exception as e:
        print("Error al obtener datos:")
        print(e)

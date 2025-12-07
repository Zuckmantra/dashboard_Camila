from fastapi import FastAPI, Depends, HTTPException, Request, status, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict
from fastapi.responses import JSONResponse
from datetime import datetime
from database import DBSessionLocal, db_engine, load_whatsapp_messages, load_chat_history_by_session
import models
from fastapi.middleware.cors import CORSMiddleware
import os

PASSLIB_AVAILABLE = False
pwd_context = None
from jose import JWTError, jwt
from datetime import timedelta

models.DBBase.metadata.create_all(bind=db_engine)

app = FastAPI()


class LoginRequest(BaseModel):
    correo: str
    contrasena: str

class UserResponse(BaseModel):
    nombre: str
    correo: str
    area: str


SECRET_KEY = os.getenv("SECRET_KEY") or "change-me-to-a-random-secret"
ALGORITHM = os.getenv("JWT_ALGORITHM") or "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES") or "60")


def verify_password(plain_password, stored_value):
    if not stored_value:
        return False
    try:
        if isinstance(plain_password, str):
            p = plain_password.strip()
        else:
            p = plain_password
        if isinstance(stored_value, str):
            s = stored_value.strip()
        else:
            s = stored_value
        return p == s
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=7)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_user_by_correo(correo: str):
    from database import connect_postgres
    from psycopg2 import sql
    conn = connect_postgres()
    cur = conn.cursor()
    print(f"connect_postgres: connection ok to {conn.dsn}")
    def fetch_from_table(schema_name: str, table_name: str):
        """Fetch user row from given schema.table using only available columns."""
        try:
            cur.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_schema = %s AND table_name = %s",
                (schema_name, table_name),
            )
            cols = [r[0].lower() for r in cur.fetchall()]
            want = ["id", "nombre", "correo", "password_hash", "contrasena", "area"]
            select_cols = [c for c in want if c in cols]
            if not select_cols:
                return None
            ident = sql.Identifier(schema_name, table_name)
            sel = sql.SQL(', ').join(sql.Identifier(c) for c in select_cols)
            q = sql.SQL("SELECT {sel} FROM {tbl} WHERE LOWER(correo) = LOWER(%s) LIMIT 1").format(sel=sel, tbl=ident)
            cur.execute(q, (correo,))
            row = cur.fetchone()
            if not row:
                return None
            result = {k: None for k in want}
            for idx, col in enumerate(select_cols):
                result[col] = row[idx]
            return result
        except Exception as e:
            print(f"fetch_from_table error for {schema_name}.{table_name}: {e}")
            return None

    candidates = [("public", "usuarios"), ("bot", "usuarios")]
    for schema_name, table_name in candidates:
        try:
            res = fetch_from_table(schema_name, table_name)
            if res:
                cur.close()
                conn.close()
                print(f"get_user_by_correo: found user in {schema_name}.{table_name}: {res.get('correo')}")
                return {
                    "id": res.get('id'),
                    "nombre": res.get('nombre'),
                    "correo": res.get('correo'),
                    "password_hash": res.get('password_hash'),
                    "contrasena": res.get('contrasena'),
                    "area": res.get('area'),
                }
        except Exception as e:
            print(f"get_user_by_correo: error querying {schema_name}.{table_name}: {e}")

    try:
        cur.execute("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name ILIKE '%usuario%' OR table_name ILIKE '%usuarios%'")
        tables = cur.fetchall()
        for schema, table in tables:
            res = fetch_from_table(schema, table)
            if res:
                cur.close()
                conn.close()
                print(f"get_user_by_correo: found user in {schema}.{table}: {res.get('correo')}")
                return {
                    "id": res.get('id'),
                    "nombre": res.get('nombre'),
                    "correo": res.get('correo'),
                    "password_hash": res.get('password_hash'),
                    "contrasena": res.get('contrasena'),
                    "area": res.get('area'),
                }
    except Exception as e:
        print(f"get_user_by_correo: error listing tables: {e}")

    cur.close()
    conn.close()
    return None


def _extract_bearer_token(request: Request) -> str:
    auth = request.headers.get('authorization', '') or request.headers.get('Authorization', '')
    if isinstance(auth, str) and auth.lower().startswith('bearer '):
        return auth[7:]
    return auth or ''


def get_current_user(token: str = Depends(_extract_bearer_token)):
    """Dependency: validate Bearer token from Authorization header and return user dict."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        correo: str = payload.get("sub")
        if correo is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user_by_correo(correo)
    if user is None:
        raise credentials_exception
    return user

@app.post("/api/auth/login")
def login(request_data: LoginRequest, response: Response):
    """Validate credentials, return access token and set refresh_token HttpOnly cookie."""

    debug_mode = os.getenv('DEBUG', '0') in ('1', 'true', 'True')


    correo_in = (request_data.correo or '').strip()
    print(f"login attempt for correo: {correo_in}")
    user = get_user_by_correo(correo_in)
    if not user:
        if debug_mode:
            return JSONResponse(status_code=401, content={"detail": "Correo o contraseña inválidos", "debug": "user_not_found"})
        raise HTTPException(status_code=401, detail="Correo o contraseña inválidos")

    hashed = user.get("password_hash")

    provided_pw = (request_data.contrasena or '').strip()
    stored_hash = user.get('password_hash')
    stored_plain = user.get('contrasena')

    ok = False

    if stored_hash:
      
        if isinstance(stored_hash, str) and provided_pw == stored_hash.strip():
            ok = True

    if not ok and stored_plain:
        if provided_pw == (stored_plain or '').strip():
            ok = True

    if not ok:

        if debug_mode:
            return JSONResponse(status_code=401, content={"detail": "Correo o contraseña inválidos", "debug": {"provided": provided_pw, "stored_plain": stored_plain}})
        raise HTTPException(status_code=401, detail="Correo o contraseña inválidos")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.get("correo"), "area": user.get("area"), "user_id": user.get("id")},
        expires_delta=access_token_expires,
    )

    refresh_token = create_refresh_token(
        data={"sub": user.get("correo"), "area": user.get("area"), "user_id": user.get("id")},
        expires_delta=timedelta(days=7),
    )

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=7 * 24 * 3600,
        path="/",
    )

    try:
        masked = (refresh_token[:8] + '...' + refresh_token[-8:]) if isinstance(refresh_token, str) else str(refresh_token)
    except Exception:
        masked = '***'
    print(f"login: set refresh_token cookie (masked)={masked} for user={user.get('correo')}")
    resp = {"access_token": access_token, "token_type": "bearer", "user": {"nombre": user.get("nombre"), "correo": user.get("correo"), "area": user.get("area")}, "refresh_token": refresh_token}
    return resp

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = DBSessionLocal()
    try:
        yield db
    finally:
        db.close()

class ClienteBase(BaseModel):
    nombre: str
    email: str
    telefono: str
    ubicacion: str

class ClienteCreate(ClienteBase):
    pass

class ClienteResponse(ClienteBase):
    id: int
    estado: str
    tasa_conversion: float
    satisfaccion: float
    fecha_registro: datetime

    class Config:
        from_attributes = True

class DashboardStats(BaseModel):
    conversaciones_total: int
    tasa_conversion_avg: float
    clientes_unicos: int
    satisfaccion_avg: float


@app.get("/api/dashboard/stats")
def get_dashboard_stats(limit: int = 10, current_user: dict = Depends(get_current_user)):
    user_area = (current_user.get("area") or "").upper()
    if user_area not in ("TI", "ADMIN"):
        raise HTTPException(status_code=403, detail="No autorizado para ver el dashboard")

    session = DBSessionLocal()
    try:
        try:
            total_clients = session.query(models.Cliente).count()
        except Exception:
            total_clients = 0

        recent = []
        try:
            rows = session.query(models.Cliente).order_by(models.Cliente.fecha_registro.desc()).limit(limit).all()
            for r in rows:
                recent.append({"id": r.id, "nombre": r.nombre, "email": r.email, "fecha_registro": r.fecha_registro})
        except Exception:
            recent = []

        return {"total_clients": total_clients, "recent_clients": recent}
    finally:
        session.close()


@app.get("/api/dashboard/charts")
def get_dashboard_charts(period: str = 'day', days: int = 7, month: int | None = None, year: int | None = None, current_user: dict = Depends(get_current_user)):
    user_area = (current_user.get("area") or "").upper()
    if user_area not in ("TI", "ADMIN"):
        raise HTTPException(status_code=403, detail="No autorizado para ver el dashboard")

    from database import connect_postgres
    import psycopg2.extras
    import json

    conn = None
    try:
        conn = connect_postgres()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute("SELECT COUNT(*) AS total_clients FROM public.clientes")
        total_clients = int(cur.fetchone().get('total_clients') or 0)

        cur.execute("SELECT COUNT(*) AS active_clients FROM public.clientes WHERE LOWER(estado) <> 'cerrado'")
        active_clients = int(cur.fetchone().get('active_clients') or 0)

        cur.execute("SELECT COUNT(*) AS new_today FROM public.clientes WHERE fecha_registro >= current_date")
        new_today = int(cur.fetchone().get('new_today') or 0)

        cur.execute("SELECT COALESCE(SUM(monto),0) AS ingresos_30d FROM public.pagos WHERE fecha_pago >= now() - interval '30 days'")
        ingresos_30d = float(cur.fetchone().get('ingresos_30d') or 0)

        cur.execute("SELECT COUNT(*) AS ofertas_abiertas FROM public.ofertas WHERE estado = 'ABIERTA'")
        ofertas_abiertas = int(cur.fetchone().get('ofertas_abiertas') or 0)

        conversations_by_day = []
        conversations_by_month = []

        ts_col = 'timestamp'
        try:
            cur.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'bot' AND table_name = 'whatsapp' AND column_name IN ('timestamp','fecha_hora')
            """)
            found = [r.get('column_name') for r in cur.fetchall()]
            if 'timestamp' in found:
                ts_col = 'timestamp'
            elif 'fecha_hora' in found:
                ts_col = 'fecha_hora'
        except Exception:
            ts_col = 'timestamp'

        if period == 'day':
            try:
                days_int = int(days) if isinstance(days, int) else 7
                if days_int < 1:
                    days_int = 7
                sql = f"""
                    SELECT to_char({ts_col}::date, 'YYYY-MM-DD') AS day, COUNT(*) AS count
                    FROM bot.whatsapp
                    WHERE {ts_col} >= now() - interval '{days_int} days'
                    GROUP BY day ORDER BY day
                """
                cur.execute(sql)
                conv_rows = cur.fetchall()
                conversations_by_day = [{ 'day': r['day'], 'count': int(r['count']) } for r in conv_rows]
            except Exception:
                conversations_by_day = []
        else:
            try:
                if isinstance(month, int) and isinstance(year, int) and 1 <= month <= 12:
                    from datetime import date
                    start = date(year, month, 1)
                    if month == 12:
                        end = date(year + 1, 1, 1)
                    else:
                        end = date(year, month + 1, 1)

                    sql = f"""
                        SELECT to_char({ts_col}::date, 'YYYY-MM') AS month, COUNT(*) AS count
                        FROM bot.whatsapp
                        WHERE {ts_col} >= %s AND {ts_col} < %s
                        GROUP BY month ORDER BY month
                    """
                    cur.execute(sql, (start, end))
                    conv_rows = cur.fetchall()
                    conversations_by_month = [{ 'month': r['month'], 'count': int(r['count']) } for r in conv_rows]

                    try:
                        cur.execute(f"SELECT COUNT(*) AS cnt FROM bot.whatsapp WHERE {ts_col} >= %s AND {ts_col} < %s", (start, end))
                        conversations_by_month_total = int(cur.fetchone().get('cnt') or 0)
                        conversations_total = conversations_by_month_total
                    except Exception:
                        pass
                else:
                    sql = f"""
                        SELECT to_char({ts_col}::date, 'YYYY-MM') AS month, COUNT(*) AS count
                        FROM bot.whatsapp
                        WHERE {ts_col} >= (date_trunc('month', current_date) - interval '11 months')
                        GROUP BY month ORDER BY month
                    """
                    cur.execute(sql)
                    conv_rows = cur.fetchall()
                    conversations_by_month = [{ 'month': r['month'], 'count': int(r['count']) } for r in conv_rows]
            except Exception:
                conversations_by_month = []

        try:
            order_col = ts_col if ts_col else 'timestamp'
            cur.execute(f"SELECT message FROM bot.whatsapp ORDER BY {order_col} DESC LIMIT 1000")
            msgs = [r.get('message') for r in cur.fetchall()]
        except Exception:
            msgs = []

        pos_k = ['gracias', 'excelente', 'bien', 'perfecto', 'genial', 'feliz', 'bueno', 'ok', 'okey']
        neg_k = ['malo', 'problema', 'error', 'no funciona', 'mal', 'falla', 'reclamo', 'insatisfecho']
        counts = {'Positivo': 0, 'Negativo': 0, 'Neutral': 0}
        for m in msgs:
            text = ''
            if isinstance(m, str):
                text = m.lower()
            else:
                try:
                    text = json.dumps(m).lower()
                except Exception:
                    text = str(m).lower()
            if any(k in text for k in pos_k):
                counts['Positivo'] += 1
            elif any(k in text for k in neg_k):
                counts['Negativo'] += 1
            else:
                counts['Neutral'] += 1

        total_msgs = max(1, counts['Positivo'] + counts['Negativo'] + counts['Neutral'])
        sentiment_breakdown = [
            { 'name': 'Positivo', 'value': round(counts['Positivo'] * 100.0 / total_msgs, 1) },
            { 'name': 'Negativo', 'value': round(counts['Negativo'] * 100.0 / total_msgs, 1) },
            { 'name': 'Neutral',  'value': round(counts['Neutral']  * 100.0 / total_msgs, 1) },
        ]

        try:
            sum_vals = sum([s.get('value', 0) for s in sentiment_breakdown])
            if sum_vals <= 0.1:
                cliente_counts = {'Positivo': 0, 'Negativo': 0, 'Neutral': 0}
                try:
                    cur.execute("SELECT estado, COUNT(*) AS cnt FROM public.clientes GROUP BY estado")
                    rows = cur.fetchall()
                    for r in rows:
                        estado = (r.get('estado') or '').lower() if isinstance(r.get('estado'), str) else ''
                        cnt = int(r.get('cnt') or 0)
                        if any(k in estado for k in ['cerrado', 'perdido', 'rechazado', 'cancelado']):
                            cliente_counts['Negativo'] += cnt
                        elif any(k in estado for k in ['activo', 'abierto', 'abierta', 'contactado', 'prospecto', 'interesado']):
                            cliente_counts['Positivo'] += cnt
                        else:
                            cliente_counts['Neutral'] += cnt
                except Exception:
                    cliente_counts = cliente_counts

                total_c = max(1, cliente_counts['Positivo'] + cliente_counts['Negativo'] + cliente_counts['Neutral'])
                sentiment_breakdown = [
                    { 'name': 'Positivo', 'value': round(cliente_counts['Positivo'] * 100.0 / total_c, 1) },
                    { 'name': 'Negativo', 'value': round(cliente_counts['Negativo'] * 100.0 / total_c, 1) },
                    { 'name': 'Neutral',  'value': round(cliente_counts['Neutral']  * 100.0 / total_c, 1) },
                ]
                try:
                    resp_counts = cliente_counts
                except Exception:
                    resp_counts = None
            else:
                resp_counts = None
        except Exception:
            resp_counts = None

        try:
            cur.execute("SELECT COUNT(*) AS total_convs FROM public.n8n_chat_histories")
            conversations_total = int(cur.fetchone().get('total_convs') or 0)
        except Exception:
            try:
                cur.execute("SELECT COUNT(*) AS total_convs FROM bot.whatsapp")
                conversations_total = int(cur.fetchone().get('total_convs') or 0)
            except Exception:
                conversations_total = 0

        resp = {
            'total_clients': total_clients,
            'active_clients': active_clients,
            'new_today': new_today,
            'ingresos_30d': ingresos_30d,
            'ofertas_abiertas': ofertas_abiertas,
            'conversations_total': conversations_total,
            'conversations_by_day': conversations_by_day,
            'conversations_by_month': conversations_by_month,
            'sentiment_breakdown': sentiment_breakdown,
        }

        try:
            cur.execute("SELECT estado, COUNT(*) as cnt FROM public.clientes GROUP BY estado")
            rows = cur.fetchall()
            estado_counts = {'Nuevo': 0, 'En gestión': 0, 'Cliente': 0, 'Otros': 0}
            for r in rows:
                est = (r.get('estado') or '').strip()
                est_l = est.lower()
                cnt = int(r.get('cnt') or 0)
                if 'nuevo' in est_l:
                    estado_counts['Nuevo'] += cnt
                elif 'gest' in est_l or 'gestion' in est_l or 'gestión' in est_l:
                    estado_counts['En gestión'] += cnt
                elif 'cliente' in est_l or 'cliente' == est_l:
                    estado_counts['Cliente'] += cnt
                else:
                    estado_counts['Otros'] += cnt

            total_est = max(1, estado_counts['Nuevo'] + estado_counts['En gestión'] + estado_counts['Cliente'] + estado_counts['Otros'])
            status_breakdown = [
                {'name': 'Nuevo', 'value': round(estado_counts['Nuevo'] * 100.0 / total_est, 1)},
                {'name': 'En gestión', 'value': round(estado_counts['En gestión'] * 100.0 / total_est, 1)},
                {'name': 'Cliente', 'value': round(estado_counts['Cliente'] * 100.0 / total_est, 1)},
                {'name': 'Otros', 'value': round(estado_counts['Otros'] * 100.0 / total_est, 1)},
            ]
            resp['status_breakdown'] = status_breakdown
            resp['status_counts'] = estado_counts
        except Exception:
            pass

        cur.close()
        return resp
    finally:
        try:
            if conn:
                conn.close()
        except Exception:
            pass

@app.get("/api/clientes", response_model=List[ClienteResponse])
def get_clientes(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    clientes = db.query(models.Cliente).offset(skip).limit(limit).all()
    return clientes

@app.post("/api/clientes", response_model=ClienteResponse)
def create_cliente(cliente: ClienteCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    db_cliente = models.Cliente(**cliente.dict())
    db.add(db_cliente)
    db.commit()
    db.refresh(db_cliente)
    return db_cliente

@app.get("/api/clientes/{cliente_id}", response_model=ClienteResponse)
def get_cliente(cliente_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
    if cliente is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return cliente


@app.get("/api/whatsapp")
def get_whatsapp(limit: int = 100, current_user: dict = Depends(get_current_user)):
    """Return rows from bot.whatsapp as a list of dicts."""
    return load_whatsapp_messages(limit=limit)


@app.get("/api/chats/{session_id}")
def get_chat_history(session_id: str, limit: int = 100, current_user: dict = Depends(get_current_user)):
    """Return chat history rows for a given session_id from n8n_chat_histories."""
    return load_chat_history_by_session(session_id=session_id, limit=limit)


@app.get("/api/n8n_chats")
def list_n8n_sessions(limit: int = 200, current_user: dict = Depends(get_current_user)):
    from database import connect_postgres
    import json
    conn = None
    try:
        conn = connect_postgres()
        cur = conn.cursor()
        cur.execute("""
            SELECT t.session_id, t.id AS last_id, t.message
            FROM public.n8n_chat_histories t
            WHERE t.id IN (
                SELECT MAX(id) FROM public.n8n_chat_histories GROUP BY session_id
            )
            ORDER BY last_id DESC
            LIMIT %s
        """, (limit,))
        rows = cur.fetchall()
        sessions = []
        for r in rows:
            sid = r[0]
            last_id = r[1]
            msg = r[2]
            last_msg = msg
            if isinstance(msg, str):
                try:
                    last_msg = json.loads(msg)
                except Exception:
                    last_msg = msg

            cur2 = conn.cursor()
            cur2.execute("SELECT COUNT(*) FROM public.n8n_chat_histories WHERE session_id = %s", (sid,))
            cnt = cur2.fetchone()[0]
            cur2.close()
            sessions.append({"session_id": sid, "last_id": last_id, "last_message": last_msg, "count": cnt})
        cur.close()
        return sessions
    finally:
        try:
            if conn:
                conn.close()
        except Exception:
            pass


@app.post('/api/auth/refresh')
async def refresh_token(request: Request):
    token = request.cookies.get('refresh_token')
    if not token:
        auth_hdr = request.headers.get('authorization') or request.headers.get('Authorization')
        if isinstance(auth_hdr, str) and auth_hdr.lower().startswith('bearer '):
            token = auth_hdr[7:]

    if not token:
        try:
            body = await request.json()
            if isinstance(body, dict):
                token = body.get('refresh_token')
        except Exception:
            token = token

    if not token:
        print('refresh_token: no token provided via cookie/header/body')
        raise HTTPException(status_code=401, detail='No refresh token')

    try:
        masked = token[:8] + '...' + token[-8:]
    except Exception:
        masked = str(token)
    print(f'refresh_token: token received (masked)={masked}')
    try:
        print('refresh_token: request.cookies=', dict(request.cookies))
    except Exception as e:
        print('refresh_token: cannot read request.cookies', e)
    try:
        ah = request.headers.get('authorization') or request.headers.get('Authorization')
        print('refresh_token: Authorization header present=', bool(ah))
    except Exception:
        pass

    try:
        body_preview = await request.body()
        if body_preview:
            bp = body_preview.decode('utf-8', errors='replace')
            print('refresh_token: request.body=', bp[:400])
    except Exception:
        pass

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get('type') != 'refresh' and payload.get('type') is not None:
            print('refresh_token: token present but invalid type', payload.get('type'))
            raise HTTPException(status_code=401, detail='Invalid token type')
        correo = payload.get('sub')
    except JWTError as e:
        print('refresh_token: JWT decode error:', repr(e))
        raise HTTPException(status_code=401, detail='Invalid refresh token')

    user = get_user_by_correo(correo)
    if not user:
        raise HTTPException(status_code=401, detail='User not found')

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.get("correo"), "area": user.get("area"), "user_id": user.get("id")},
        expires_delta=access_token_expires,
    )
    return {"access_token": access_token, "token_type": "bearer", "user": {"nombre": user.get("nombre"), "correo": user.get("correo"), "area": user.get("area")}}


@app.post('/api/auth/logout')
def logout(response: Response):

    response.delete_cookie('refresh_token', path='/')
    return {"status": "ok"}



@app.get('/api/debug/dbinfo')
def debug_dbinfo():
    from database import db_username, db_password, db_host, db_port, db_name, DATABASE_URL
    masked = DATABASE_URL
    try:

        if db_password:
            masked = masked.replace(db_password, '***')
    except Exception:
        pass
    return {"db_user": db_username, "db_host": db_host, "db_port": db_port, "db_name": db_name, "database_url": masked}


@app.get('/api/debug/user')
def debug_user(correo: str):
    user = get_user_by_correo(correo)
    if not user:
        return {"found": False}

    return {"found": True, "id": user.get("id"), "nombre": user.get("nombre"), "correo": user.get("correo"), "password_hash": user.get("password_hash"), "contrasena": user.get("contrasena"), "area": user.get("area")}


@app.post("/api/auth/microsoft")
def microsoft_auth(token: str):
    return {"status": "success", "user": "user@example.com"}
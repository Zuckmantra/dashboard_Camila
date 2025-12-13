
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def test_login_fail():
    response = client.post("/api/auth/login", json={
        "correo": "noexiste@correo.com",
        "contrasena": "incorrecta"
    })
    assert response.status_code == 401
    assert "detail" in response.json()

def test_refresh_token_fail():
    response = client.post("/api/auth/refresh")
    assert response.status_code == 401
    assert response.json()["detail"] == "No refresh token"

def test_dashboard_stats_unauthorized():
    response = client.get("/api/dashboard/stats")
    assert response.status_code == 401 or response.status_code == 403

def test_dashboard_charts_unauthorized():
    response = client.get("/api/dashboard/charts")
    assert response.status_code == 401 or response.status_code == 403

def test_clientes_unauthorized():
    response = client.get("/api/clientes")
    assert response.status_code == 401 or response.status_code == 403

def test_logout():
    response = client.post("/api/auth/logout")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

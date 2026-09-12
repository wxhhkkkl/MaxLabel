import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import config, security
from app.database import Base, get_db
from app.main import app


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """Run API routes against an isolated SQLite database."""
    database_url = f"sqlite:///{tmp_path / 'api.db'}"
    test_engine = create_engine(database_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(test_engine)
    testing_session = sessionmaker(bind=test_engine, autoflush=False, expire_on_commit=False)

    def override_get_db():
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    monkeypatch.setattr(config, "JWT_SECRET", "api-test-secret-that-is-long-enough-123456")
    app.dependency_overrides[get_db] = override_get_db
    security._RATE_LIMIT_EVENTS.clear()
    try:
        # Do not enter the TestClient context: the app lifespan would migrate
        # the development database instead of the isolated dependency override.
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
        test_engine.dispose()


def register(client: TestClient, email: str, password: str = "secret123", web: bool = False):
    headers = {"X-MaxLabel-Client": "web"} if web else {}
    response = client.post("/api/auth/register", json={"email": email, "password": password}, headers=headers)
    assert response.status_code == 200, response.text
    return response


def test_cookie_auth_does_not_expose_jwt_to_web_client(client):
    response = register(client, "cookie@example.com", web=True)
    assert response.json()["token"] == ""
    assert "maxlabel_session=" in response.headers["set-cookie"]

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "cookie@example.com"
    assert me.json()["role"] == "user"

    assert client.post("/api/auth/logout").status_code == 403
    csrf = client.cookies.get(security.CSRF_COOKIE)
    assert csrf
    assert client.post("/api/auth/logout", headers={"X-MaxLabel-CSRF": csrf}).json() == {"ok": True}
    assert client.get("/api/auth/me").status_code == 401


def test_cookie_state_change_requires_matching_csrf_token(client):
    register(client, "csrf@example.com", web=True)
    csrf = client.cookies.get(security.CSRF_COOKIE)
    assert csrf
    missing = client.post("/api/auth/change-password", json={"old_password": "secret123", "new_password": "newsecret123"})
    assert missing.status_code == 403
    mismatched = client.post(
        "/api/auth/change-password",
        headers={"X-MaxLabel-CSRF": "wrong"},
        json={"old_password": "secret123", "new_password": "newsecret123"},
    )
    assert mismatched.status_code == 403


def test_bearer_auth_and_template_isolation(client):
    alice = register(client, "alice@example.com").json()["token"]
    saved = client.post(
        "/api/cloud/templates",
        headers={"Authorization": f"Bearer {alice}"},
        json={"name": "shared-name", "data": "{\"objects\":[]}"},
    )
    assert saved.status_code == 200, saved.text
    template_id = saved.json()["id"]

    bob = register(client, "bob@example.com").json()["token"]
    assert client.get("/api/cloud/templates", headers={"Authorization": f"Bearer {bob}"}).json() == []
    assert client.get(f"/api/cloud/templates/{template_id}", headers={"Authorization": f"Bearer {bob}"}).status_code == 404

    loaded = client.get(f"/api/cloud/templates/{template_id}", headers={"Authorization": f"Bearer {alice}"})
    assert loaded.status_code == 200
    assert loaded.json()["data"] == "{\"objects\":[]}"


def test_cloud_templates_reject_malformed_json(client):
    token = register(client, "json@example.com").json()["token"]
    response = client.post(
        "/api/cloud/templates",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "bad", "data": "not-json"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "模板数据不是有效 JSON"


def test_cloud_templates_redact_connection_password(client):
    token = register(client, "redact@example.com").json()["token"]
    response = client.post(
        "/api/cloud/templates",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "with-connection",
            "data": '{"connections":{"db":{"driver":"mysql","password":"do-not-store"}}}',
        },
    )
    assert response.status_code == 200, response.text
    template_id = response.json()["id"]
    loaded = client.get(f"/api/cloud/templates/{template_id}", headers={"Authorization": f"Bearer {token}"})
    assert loaded.status_code == 200
    assert "password" not in loaded.json()["data"]


def test_register_rate_limit_is_shared_in_database(client):
    for index in range(5):
        response = client.post(
            "/api/auth/register",
            json={"email": f"limited-{index}@example.com", "password": "secret123"},
        )
        assert response.status_code == 200, response.text
    blocked = client.post(
        "/api/auth/register",
        json={"email": "limited-blocked@example.com", "password": "secret123"},
    )
    assert blocked.status_code == 429


def test_protected_routes_require_authentication(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/cloud/templates").status_code == 401


def test_login_password_is_bounded(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "bounded@example.com", "password": "x" * 129},
    )
    assert response.status_code == 422


def test_invalid_environment_is_rejected(client, monkeypatch):
    monkeypatch.setattr(config, "ENV", "prod")
    with pytest.raises(RuntimeError, match="MAXLABEL_CLOUD_ENV"):
        config.validate_runtime()

"""MaxLabel 云服务后端数据模型与启动迁移。

生产数据库由运维预创建；只有显式设置 MAXLABEL_DB_AUTO_CREATE=1 时才尝试
创建 MySQL 数据库。旧库的轻量迁移失败会阻止服务启动，不再静默吞错。
"""
from datetime import datetime, timezone
from contextlib import contextmanager
import os
from pathlib import Path
from threading import Lock

from sqlalchemy import BigInteger, Column, ForeignKey, Integer, String, Text, UniqueConstraint, create_engine, event, inspect, text
from sqlalchemy.engine import URL
from sqlalchemy.orm import declarative_base, sessionmaker

from . import config

Base = declarative_base()
SCHEMA_VERSION = 4
_MIGRATION_THREAD_LOCK = Lock()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(16), nullable=False, default="user")  # user / admin
    token_version = Column(Integer, nullable=False, default=0)
    created_at = Column(String(32), default=now_iso)


class Template(Base):
    __tablename__ = "templates"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_templates_user_name"),)
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    json = Column(Text, nullable=False, default="")
    size_bytes = Column(BigInteger, nullable=False, default=0)
    updated_at = Column(String(32), default=now_iso)


class License(Base):
    """授权密钥：由服务端管理端生成，客户端在线激活时绑定机器。"""
    __tablename__ = "licenses"
    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(64), unique=True, nullable=False, index=True)
    holder = Column(String(255), nullable=False, default="")
    # 兼容旧数据库保留该列，但产品不再区分版本，新记录统一为 standard。
    edition = Column(String(32), nullable=False, default="standard")
    status = Column(String(16), nullable=False, default="active")  # active / revoked
    expires_at = Column(String(32), nullable=True)  # ISO；None=永久
    created_at = Column(String(32), default=now_iso)
    activated_at = Column(String(32), nullable=True)
    machine_id = Column(String(64), nullable=True)  # 绑定的机器码


class ActivationLog(Base):
    """激活/校验流水（审计用）。"""
    __tablename__ = "activation_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    license_key = Column(String(64), index=True)
    machine_id = Column(String(64))
    action = Column(String(16))  # activate / check / fail
    detail = Column(String(255), default="")
    created_at = Column(String(32), default=now_iso)


class RateLimitBucket(Base):
    """Shared fixed-window counters for public endpoints.

    Keeping the bucket in the application database makes limits consistent
    across local worker processes.  Large multi-instance deployments should
    still enforce an edge limiter (Redis/WAF/reverse proxy) before the app.
    """
    __tablename__ = "rate_limit_buckets"
    bucket_key = Column(String(512), primary_key=True)
    window_started = Column(Integer, nullable=False)
    hit_count = Column(Integer, nullable=False, default=0)
    updated_at = Column(Integer, nullable=False)


# ---------- 引擎 ----------
USE_MYSQL = config.DB_DRIVER == "mysql"

if USE_MYSQL:
    _engine_url = URL.create(
        "mysql+pymysql",
        username=config.DB_USER,
        password=config.DB_PASSWORD,
        host=config.DB_HOST,
        port=config.DB_PORT,
        database=config.DB_NAME,
        query={"charset": "utf8mb4"},
    )
    engine = create_engine(
        _engine_url,
        pool_pre_ping=True,
        pool_recycle=3600,
        pool_size=5,
        max_overflow=10,
    )
else:
    engine = create_engine(
        f"sqlite:///{config.DB_PATH}",
        connect_args={"check_same_thread": False, "timeout": 5},
    )

    @event.listens_for(engine, "connect")
    def _configure_sqlite(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA busy_timeout=5000")
        finally:
            cursor.close()

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def _ensure_mysql_database() -> None:
    """连接前自动创建目标数据库（root 权限，utf8mb4）。"""
    import pymysql

    conn = pymysql.connect(
        host=config.DB_HOST,
        port=config.DB_PORT,
        user=config.DB_USER,
        password=config.DB_PASSWORD,
        charset="utf8mb4",
    )
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"CREATE DATABASE IF NOT EXISTS `{config.DB_NAME}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        conn.commit()
    finally:
        conn.close()


def _ensure_columns() -> None:
    """轻量迁移：为旧库补充新增列（users.role 等），MySQL / SQLite 双兼容。"""
    try:
        with engine.connect() as conn:
            if USE_MYSQL:
                rows = conn.exec_driver_sql(
                    "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'"
                ).fetchall()
                cols = [r[0] for r in rows]
                if cols:
                    if "role" not in cols:
                        conn.exec_driver_sql("ALTER TABLE users ADD COLUMN role VARCHAR(16) DEFAULT 'user'")
                    if "token_version" not in cols:
                        conn.exec_driver_sql("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0")
                template_rows = conn.exec_driver_sql(
                    "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'templates'"
                ).fetchall()
                template_cols = [r[0] for r in template_rows]
                if template_cols and "size_bytes" not in template_cols:
                    conn.exec_driver_sql("ALTER TABLE templates ADD COLUMN size_bytes BIGINT NOT NULL DEFAULT 0")
                if template_cols:
                    conn.exec_driver_sql("UPDATE templates SET size_bytes = OCTET_LENGTH(json) WHERE size_bytes = 0 AND json <> ''")
                conn.commit()
            else:
                rows = conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()
                cols = [r[1] for r in rows]
                if cols:
                    if "role" not in cols:
                        conn.exec_driver_sql("ALTER TABLE users ADD COLUMN role VARCHAR(16) DEFAULT 'user'")
                    if "token_version" not in cols:
                        conn.exec_driver_sql("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0")
                template_rows = conn.exec_driver_sql("PRAGMA table_info(templates)").fetchall()
                template_cols = [r[1] for r in template_rows]
                if template_cols and "size_bytes" not in template_cols:
                    conn.exec_driver_sql("ALTER TABLE templates ADD COLUMN size_bytes INTEGER NOT NULL DEFAULT 0")
                if template_cols:
                    conn.exec_driver_sql("UPDATE templates SET size_bytes = length(CAST(json AS BLOB)) WHERE size_bytes = 0 AND json <> ''")
                conn.commit()
    except Exception as exc:
        raise RuntimeError("数据库结构检查/迁移失败，请检查数据库权限与迁移状态") from exc


def _ensure_constraints() -> None:
    """补齐 create_all 无法修改的旧表约束，并把重复数据明确暴露给运维。"""
    try:
        inspector = inspect(engine)
        if "templates" not in inspector.get_table_names():
            return
        constraints = inspector.get_unique_constraints("templates")
        indexes = inspector.get_indexes("templates")
        names = {str(item.get("name")) for item in constraints}
        names.update(str(item.get("name")) for item in indexes if item.get("unique"))
        if "uq_templates_user_name" in names:
            return
        with engine.begin() as conn:
            conn.execute(text(
                "CREATE UNIQUE INDEX uq_templates_user_name "
                "ON templates (user_id, name)"
            ))
    except Exception as exc:
        raise RuntimeError(
            "模板表缺少用户+名称唯一约束，迁移失败；请先清理同一用户下的重名模板后重试"
        ) from exc


def _read_schema_version() -> int:
    """Read the marker without creating tables or otherwise changing the DB."""
    try:
        if "maxlabel_schema_version" not in inspect(engine).get_table_names():
            return 0
        with engine.connect() as conn:
            row = conn.execute(text("SELECT version FROM maxlabel_schema_version WHERE id = 1")).first()
            return 0 if row is None else int(row[0])
    except Exception as exc:
        raise RuntimeError("无法读取数据库版本，请检查数据库权限与连接状态") from exc


def _schema_version() -> int:
    """Create the marker only after the future-version guard has passed."""
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS maxlabel_schema_version ("
            "id INTEGER PRIMARY KEY, version INTEGER NOT NULL)"
        ))
        row = conn.execute(text("SELECT version FROM maxlabel_schema_version WHERE id = 1")).first()
        if row is None:
            conn.execute(text("INSERT INTO maxlabel_schema_version (id, version) VALUES (1, 0)"))
            return 0
        return int(row[0])


def _set_schema_version(version: int) -> None:
    with engine.begin() as conn:
        conn.execute(text("UPDATE maxlabel_schema_version SET version = :version WHERE id = 1"), {"version": version})


@contextmanager
def _migration_lock():
    """Serialize schema changes in this process and across MySQL instances.

    SQLite deployments are normally single-process.  A lock file still avoids
    two locally launched service processes migrating the same database at the
    same time.  MySQL uses a server-side advisory lock so multiple workers do
    not race during startup.
    """
    with _MIGRATION_THREAD_LOCK:
        if USE_MYSQL:
            with engine.connect() as conn:
                acquired = conn.execute(text("SELECT GET_LOCK(:name, 30)"), {"name": "maxlabel_schema_migration"}).scalar()
                if acquired != 1:
                    raise RuntimeError("等待数据库迁移锁超时，请确保没有其他服务实例正在启动")
                try:
                    yield
                finally:
                    conn.execute(text("SELECT RELEASE_LOCK(:name)"), {"name": "maxlabel_schema_migration"})
            return

        lock_path = Path(config.DATA_DIR) / ".schema-migration.lock"
        lock_path.parent.mkdir(parents=True, exist_ok=True)
        with lock_path.open("a+b") as handle:
            if os.name == "nt":
                import msvcrt

                handle.seek(0)
                handle.write(b"0")
                handle.flush()
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_LOCK, 1)
                try:
                    yield
                finally:
                    handle.seek(0)
                    msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
                try:
                    yield
                finally:
                    fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def init_db() -> None:
    if USE_MYSQL:
        if config.DB_AUTO_CREATE:
            try:
                _ensure_mysql_database()
            except Exception as e:
                raise RuntimeError(
                    "无法自动创建 MySQL 数据库（%s:%s/%s）：%s。请预创建数据库，"
                    "或显式设置 MAXLABEL_DB_AUTO_CREATE=1。" % (config.DB_HOST, config.DB_PORT, config.DB_NAME, e)
                ) from e
    with _migration_lock():
        # Reject a future database before any DDL is attempted.
        version = _read_schema_version()
        if version > SCHEMA_VERSION:
            raise RuntimeError(f"数据库版本过高（{version}），当前服务最高支持 v{SCHEMA_VERSION}")
        Base.metadata.create_all(bind=engine)
        version = _schema_version()
        # Always reconcile additive columns. A previous deployment may have
        # created the version marker before an ALTER TABLE completed.
        _ensure_columns()
        # Ordered, idempotent migrations. New installations are also recorded so
        # future deployments do not have to infer schema state from table shape.
        if version < 1:
            _set_schema_version(1)
            version = 1
        # Reconcile constraints on every startup as well. A previous deployment
        # may have written the version marker before index creation completed.
        _ensure_constraints()
        if version < 2:
            _set_schema_version(2)
            version = 2
        if version < 3:
            _set_schema_version(3)
            version = 3
        if version < 4:
            _set_schema_version(4)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

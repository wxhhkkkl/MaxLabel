"""MaxLabel 云服务后端 · 数据模型。

数据库引擎：
- MySQL（腾讯云等）：server/.env 配置 MAXLABEL_DB_PASSWORD 后自动启用，
  连接前自动创建数据库（root 权限）；列迁移走 information_schema。
- SQLite：未配置 MySQL 密码时的本地回退。
"""
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from . import config

Base = declarative_base()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(16), nullable=False, default="user")  # user / admin
    created_at = Column(String(32), default=now_iso)


class Template(Base):
    __tablename__ = "templates"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    json = Column(Text, nullable=False, default="")
    updated_at = Column(String(32), default=now_iso)


class License(Base):
    """授权密钥：由服务端管理端生成，客户端在线激活时绑定机器。"""
    __tablename__ = "licenses"
    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(64), unique=True, nullable=False, index=True)
    holder = Column(String(255), nullable=False, default="")
    edition = Column(String(32), nullable=False, default="pro")  # pro / enterprise
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


# ---------- 引擎 ----------
USE_MYSQL = config.DB_DRIVER == "mysql" and bool(config.DB_PASSWORD)

if USE_MYSQL:
    _engine_url = (
        f"mysql+pymysql://{config.DB_USER}:{config.DB_PASSWORD}@"
        f"{config.DB_HOST}:{config.DB_PORT}/{config.DB_NAME}?charset=utf8mb4"
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
        connect_args={"check_same_thread": False},
    )

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
                if cols and "role" not in cols:
                    conn.exec_driver_sql("ALTER TABLE users ADD COLUMN role VARCHAR(16) DEFAULT 'user'")
                    conn.commit()
            else:
                rows = conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()
                cols = [r[1] for r in rows]
                if cols and "role" not in cols:
                    conn.exec_driver_sql("ALTER TABLE users ADD COLUMN role VARCHAR(16) DEFAULT 'user'")
                    conn.commit()
    except Exception:
        pass


def init_db() -> None:
    if USE_MYSQL:
        try:
            _ensure_mysql_database()
        except Exception as e:
            raise RuntimeError(
                "无法连接 MySQL 数据库（%s:%s/%s）：%s。"
                "请检查 server/.env 中的 MAXLABEL_DB_PASSWORD 等配置，"
                "或设置 MAXLABEL_DB_DRIVER=sqlite 使用本地库。" % (config.DB_HOST, config.DB_PORT, config.DB_NAME, e)
            ) from e
    Base.metadata.create_all(bind=engine)
    _ensure_columns()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

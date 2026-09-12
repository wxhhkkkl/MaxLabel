"""MaxLabel 云服务后端配置。

默认值适合桌面端本机调试（127.0.0.1 + SQLite）。生产环境必须显式配置
监听地址、JWT 密钥和数据库凭据，避免开发默认值被带到公网。
"""
import os
import re
import sys
from pathlib import Path

# ---------- .env 加载（server/.env，不覆盖已存在的环境变量） ----------
def _load_dotenv() -> None:
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv()


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except (TypeError, ValueError):
        # Keep import safe and let validate_runtime produce the actionable
        # configuration error instead of leaking a raw ValueError at import.
        return -1

# 服务端口（Electron 主进程据此探测）
PORT = _env_int("MAXLABEL_CLOUD_PORT", 8420)
HOST = os.environ.get("MAXLABEL_CLOUD_HOST", "127.0.0.1")
ENV = os.environ.get("MAXLABEL_CLOUD_ENV", "development").strip().lower()
CORS_ORIGINS = [x.strip() for x in os.environ.get("MAXLABEL_CLOUD_ORIGINS", "").split(",") if x.strip()]

# ---------- 数据库 ----------
DB_DRIVER = os.environ.get("MAXLABEL_DB_DRIVER", "sqlite").strip().lower()  # mysql / sqlite
DB_HOST = os.environ.get("MAXLABEL_DB_HOST", "127.0.0.1")
DB_PORT = _env_int("MAXLABEL_DB_PORT", 3306)
DB_USER = os.environ.get("MAXLABEL_DB_USER", "maxlabel")
DB_PASSWORD = os.environ.get("MAXLABEL_DB_PASSWORD", "")
DB_NAME = os.environ.get("MAXLABEL_DB_NAME", "maxlabel")
DB_AUTO_CREATE = os.environ.get("MAXLABEL_DB_AUTO_CREATE", "0").strip().lower() in {"1", "true", "yes"}

# 数据库路径（SQLite 用）：默认放在 server/data 目录
if os.environ.get("MAXLABEL_CLOUD_DATA"):
    DATA_DIR = Path(os.environ["MAXLABEL_CLOUD_DATA"])
else:
    DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "maxlabel-cloud.db"

# Vue 前端静态目录
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

# Per-account persistence quotas. The request body has a smaller individual
# limit; these values also cap aggregate database growth.
MAX_USER_TEMPLATES = 1000
MAX_USER_TEMPLATE_BYTES = 256 * 1024 * 1024

# JWT
JWT_SECRET = os.environ.get("MAXLABEL_CLOUD_SECRET", "maxlabel-cloud-dev-secret-change-me")
JWT_ALG = "HS256"
JWT_EXPIRE_HOURS = 24 * 30  # 30 天


def validate_runtime() -> None:
    """Fail fast for unsafe production defaults instead of starting half-configured."""
    if ENV not in {"development", "test", "production"}:
        raise RuntimeError("MAXLABEL_CLOUD_ENV 只能是 development、test 或 production")
    if PORT < 1 or PORT > 65535:
        raise RuntimeError("MAXLABEL_CLOUD_PORT 必须在 1-65535 范围内")
    if DB_PORT < 1 or DB_PORT > 65535:
        raise RuntimeError("MAXLABEL_DB_PORT 必须在 1-65535 范围内")
    if DB_DRIVER not in {"sqlite", "mysql"}:
        raise RuntimeError("MAXLABEL_DB_DRIVER 仅支持 sqlite 或 mysql")
    if DB_DRIVER == "mysql" and not DB_PASSWORD:
        raise RuntimeError("MySQL 必须配置 MAXLABEL_DB_PASSWORD，避免误用 SQLite 运行")
    if not re.fullmatch(r"[A-Za-z0-9_]+", DB_NAME):
        raise RuntimeError("MAXLABEL_DB_NAME 只能包含字母、数字和下划线")
    if ENV == "production":
        if len(JWT_SECRET) < 32 or JWT_SECRET == "maxlabel-cloud-dev-secret-change-me":
            raise RuntimeError("生产环境必须配置 MAXLABEL_CLOUD_SECRET（至少 32 个字符）")
        if HOST in {"127.0.0.1", "localhost"}:
            raise RuntimeError("生产服务不能只监听本机，请配置 MAXLABEL_CLOUD_HOST")

# 打包为单文件 exe 时（PyInstaller onefile），资源在 _MEIPASS
if getattr(sys, "frozen", False):
    STATIC_DIR = Path(sys._MEIPASS) / "static"

"""MaxLabel 云服务后端 · 配置。

数据库支持两种：
- MySQL（腾讯云等外部数据库）：配置 server/.env 中的 MAXLABEL_DB_PASSWORD 后自动启用；
  未配置密码时回退本地 SQLite（开发/演示模式）。
- SQLite：本地默认。
"""
import os
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

# 服务端口（Electron 主进程据此探测）
PORT = int(os.environ.get("MAXLABEL_CLOUD_PORT", "8420"))
HOST = "127.0.0.1"

# ---------- 数据库 ----------
DB_DRIVER = os.environ.get("MAXLABEL_DB_DRIVER", "mysql")  # mysql / sqlite
DB_HOST = os.environ.get("MAXLABEL_DB_HOST", "bj-cdb-g04f44o8.sql.tencentcdb.com")
DB_PORT = int(os.environ.get("MAXLABEL_DB_PORT", "22326"))
DB_USER = os.environ.get("MAXLABEL_DB_USER", "root")
DB_PASSWORD = os.environ.get("MAXLABEL_DB_PASSWORD", "")
DB_NAME = os.environ.get("MAXLABEL_DB_NAME", "maxlabel")

# 数据库路径（SQLite 用）：默认放在 server/data 目录
if os.environ.get("MAXLABEL_CLOUD_DATA"):
    DATA_DIR = Path(os.environ["MAXLABEL_CLOUD_DATA"])
else:
    DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "maxlabel-cloud.db"

# Vue 前端静态目录
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

# JWT
JWT_SECRET = os.environ.get("MAXLABEL_CLOUD_SECRET", "maxlabel-cloud-dev-secret-change-me")
JWT_ALG = "HS256"
JWT_EXPIRE_HOURS = 24 * 30  # 30 天

# 打包为单文件 exe 时（PyInstaller onefile），资源在 _MEIPASS
if getattr(sys, "frozen", False):
    STATIC_DIR = Path(sys._MEIPASS) / "static"

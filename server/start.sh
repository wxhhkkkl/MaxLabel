#!/usr/bin/env bash
# =====================================================
#  MaxLabel 云服务 - Linux / macOS 启动脚本
#  用法：./start.sh   （首次需 chmod +x start.sh）
#  首次运行会自动安装依赖（需联网）
# =====================================================
set -e
cd "$(dirname "$0")"

echo
echo "  ============================================"
echo "    MaxLabel 云服务 启动中..."
echo "  ============================================"
echo

# ---- 1. 查找 Python ----
PY=""
if command -v python3 >/dev/null 2>&1; then
  PY="python3"
elif command -v python >/dev/null 2>&1; then
  PY="python"
else
  echo "  [错误] 未找到 Python，请先安装 Python 3.10+"
  exit 1
fi

# ---- 2. 检查依赖，缺失则自动安装 ----
if ! "$PY" -c "import fastapi, uvicorn, jwt, bcrypt, sqlalchemy, pydantic, pymysql, httpx" >/dev/null 2>&1; then
  echo "  [首次运行] 正在安装依赖，请稍候..."
  "$PY" -m pip install -r requirements.txt
  echo "  [完成] 依赖安装成功"
fi

# ---- 3. Database mode hint ----
"$PY" -c "from app import config; print('  DB mode: ' + ('MySQL ' + config.DB_HOST if config.DB_PASSWORD else 'SQLite (local) - set MAXLABEL_DB_PASSWORD in .env to use MySQL'))" 2>/dev/null || true

# ---- 4. Build the bundled Vue frontend when starting from a source checkout ----
if [ ! -f "static/index.html" ]; then
  if ! command -v npm >/dev/null 2>&1; then
    echo "  [错误] 未找到 npm，且 server/static 不存在。请安装 Node.js 20+，或先执行："
    echo "         cd frontend && npm ci && npm run build"
    exit 1
  fi
  echo "  [首次运行] 正在构建云服务前端..."
  (cd frontend && npm ci --no-audit --no-fund && npm run build)
  echo "  [完成] 前端构建成功"
fi

# ---- 5. Resolve and validate the effective host/port from .env ----
if ! HOST=$("$PY" -c "from app import config; config.validate_runtime(); print(config.HOST)"); then
  echo "  [错误] 服务配置无效，请检查 server/.env 和 MAXLABEL_CLOUD_HOST/PORT"
  exit 1
fi
if ! PORT=$("$PY" -c "from app import config; config.validate_runtime(); print(config.PORT)"); then
  echo "  [错误] 服务配置无效，请检查 server/.env 和 MAXLABEL_CLOUD_HOST/PORT"
  exit 1
fi

# ---- 6. Detect LAN IP for display only when LAN binding is enabled ----
LANIP=""
if [ "$HOST" != "127.0.0.1" ] && [ "$HOST" != "localhost" ] && command -v hostname >/dev/null 2>&1; then
  LANIP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi

# ---- 7. Start service ----
echo
echo "  Server:   http://$HOST:$PORT"
if [ "$HOST" = "127.0.0.1" ] || [ "$HOST" = "localhost" ]; then
  echo "  Local:    http://$HOST:$PORT/   (this computer)"
elif [ -n "$LANIP" ]; then
  echo "  LAN:      http://$LANIP:$PORT/   (clients + admin console on network)"
fi
echo "  Press Ctrl+C to stop."
echo
exec "$PY" -m uvicorn app.main:app --host "$HOST" --port "$PORT"

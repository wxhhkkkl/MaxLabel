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
if ! "$PY" -c "import fastapi, uvicorn" >/dev/null 2>&1; then
  echo "  [首次运行] 正在安装依赖，请稍候..."
  "$PY" -m pip install -r requirements.txt
  echo "  [完成] 依赖安装成功"
fi

# ---- 3. Database mode hint ----
"$PY" -c "from app import config; print('  DB mode: ' + ('MySQL ' + config.DB_HOST if config.DB_PASSWORD else 'SQLite (local) - set MAXLABEL_DB_PASSWORD in .env to use MySQL'))" 2>/dev/null || true

# ---- 4. Detect LAN IP for display ----
LANIP=""
if command -v hostname >/dev/null 2>&1; then
  LANIP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi

# ---- 4. Start service ----
echo
echo "  Server:   http://0.0.0.0:8420"
echo "  Local:    http://127.0.0.1:8420/   (this computer)"
if [ -n "$LANIP" ]; then
  echo "  LAN:      http://$LANIP:8420/   (clients + admin console on network)"
fi
echo "  Press Ctrl+C to stop."
echo
exec "$PY" -m uvicorn app.main:app --host 0.0.0.0 --port 8420

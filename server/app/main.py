"""MaxLabel 云服务后端 — FastAPI 入口。

启动后监听 127.0.0.1:8420：
- /api/auth/*  用户账户模块（注册/登录/资料/改密）
- /api/cloud/* 云服务模块（云模板库）
- /             Vue 前端 SPA（登录后进入账户与云服务界面）
"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import config
from .database import init_db
from .routers import admin, auth, cloud, license

app = FastAPI(title="MaxLabel Cloud Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(cloud.router)
app.include_router(license.router)
app.include_router(admin.router)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


# ---- Vue SPA 静态托管 ----
static_dir: Path = config.STATIC_DIR
if static_dir.exists():
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")


@app.get("/", include_in_schema=False)
def index():
    idx = static_dir / "index.html"
    if idx.exists():
        return FileResponse(idx)
    return {"service": "maxlabel-cloud", "status": "ready", "hint": "Vue 前端未构建"}


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return FileResponse(static_dir / "favicon.ico") if (static_dir / "favicon.ico").exists() else {"ok": True}


@app.get("/{full_path:path}", include_in_schema=False)
def spa_fallback(full_path: str):
    # 非 /api 路径统一回退到 index.html（Vue router history 模式）
    if full_path.startswith("api/"):
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Not Found")
    idx = static_dir / "index.html"
    if idx.exists():
        return FileResponse(idx)
    return {"service": "maxlabel-cloud", "status": "ready"}


def main() -> None:
    import uvicorn

    print(f"MAXLABEL_CLOUD_READY http://{config.HOST}:{config.PORT}", flush=True)
    uvicorn.run(app, host=config.HOST, port=config.PORT, log_level="warning")


if __name__ == "__main__":
    main()

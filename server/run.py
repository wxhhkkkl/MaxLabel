"""PyInstaller 打包入口（开发时同 python -m uvicorn app.main:app）。"""
from app.main import main

if __name__ == "__main__":
    main()

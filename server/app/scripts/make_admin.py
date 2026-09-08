"""服务端管理脚本：把指定用户设为管理员（管理后台入口）。

用法（在 server/ 目录下）：
    python -m app.scripts.make_admin --email admin@example.com
"""
import argparse

from app.database import SessionLocal, User, init_db


def make_admin(email: str) -> None:
    init_db()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email.strip().lower()).first()
        if not user:
            print(f"未找到用户 {email}，请先在前端注册该账户")
            return
        user.role = "admin"
        db.commit()
        print(f"已将 {user.email} 设为管理员")
    finally:
        db.close()


def main() -> None:
    ap = argparse.ArgumentParser(description="MaxLabel 管理员设置")
    ap.add_argument("--email", required=True, help="用户邮箱")
    args = ap.parse_args()
    make_admin(args.email)


if __name__ == "__main__":
    main()

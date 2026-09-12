"""服务端管理脚本：生成授权密钥并写入数据库。

用法（在 server/ 目录下）：
    python -m app.scripts.gen_license generate --days 365 --holder "客户名"
    python -m app.scripts.gen_license generate --permanent --holder "终身用户"
    python -m app.scripts.list_licenses        # 查看全部
    python -m app.scripts.revoke_license --key XXXX   # 撤销
"""
import argparse
import secrets
import sys
from datetime import datetime, timedelta, timezone

from app.database import License, SessionLocal, init_db, now_iso


def new_key() -> str:
    raw = secrets.token_hex(8).upper()
    return "-".join(raw[i : i + 4] for i in range(0, 16, 4))


def generate(days: int, holder: str, permanent: bool) -> str:
    init_db()
    db = SessionLocal()
    try:
        key = new_key()
        while db.query(License).filter(License.key == key).first():
            key = new_key()
        expires = None if permanent else (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
        lic = License(key=key, holder=holder, edition="standard", expires_at=expires, created_at=now_iso())
        db.add(lic)
        db.commit()
        return key
    finally:
        db.close()


def list_licenses() -> None:
    init_db()
    db = SessionLocal()
    try:
        rows = db.query(License).order_by(License.id.desc()).all()
        if not rows:
            print("（无授权记录）")
            return
        print(f"{'KEY':<23} {'STATUS':<8} {'MACHINE':<18} {'EXPIRES':<26} HOLDER")
        for r in rows:
            exp = (r.expires_at or "永久")[:19]
            machine = (r.machine_id or "-")[:16]
            print(f"{r.key:<23} {r.status:<8} {machine:<18} {exp:<26} {r.holder}")
    finally:
        db.close()


def revoke(key: str) -> None:
    init_db()
    db = SessionLocal()
    try:
        lic = db.query(License).filter(License.key == key.strip().upper()).first()
        if not lic:
            print("未找到该密钥")
            return
        lic.status = "revoked"
        db.commit()
        print(f"已撤销: {key}")
    finally:
        db.close()


def main() -> None:
    ap = argparse.ArgumentParser(description="MaxLabel 授权密钥管理")
    sub = ap.add_subparsers(dest="cmd", required=True)

    g = sub.add_parser("generate", help="生成密钥")
    g.add_argument("--days", type=int, default=365)
    g.add_argument("--permanent", action="store_true", help="永久有效")
    g.add_argument("--holder", default="")

    l = sub.add_parser("list", help="列出全部密钥")
    r = sub.add_parser("revoke", help="撤销密钥")
    r.add_argument("--key", required=True)

    args = ap.parse_args()
    if args.cmd == "generate":
        key = generate(args.days, args.holder, args.permanent)
        extra = "（永久）" if args.permanent else f"（{args.days} 天）"
        print(f"已生成授权密钥 {extra}: {key}")
    elif args.cmd == "list":
        list_licenses()
    elif args.cmd == "revoke":
        revoke(args.key)


if __name__ == "__main__":
    main()

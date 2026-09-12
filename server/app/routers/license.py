"""MaxLabel 云服务后端 — 授权鉴权模块路由。

客户端在线激活：
- POST /api/license/activate  { key, machine_id }  →  首次激活绑定机器
- POST /api/license/check     { key, machine_id }  →  每次启动在线复查
管理端（服务端本机脚本生成 key，见 scripts/gen_license.py）
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import update
from sqlalchemy.orm import Session

from .. import security
from ..database import ActivationLog, License, get_db, now_iso

router = APIRouter(prefix="/api/license", tags=["license"])


class ActivateIn(BaseModel):
    key: str = Field(min_length=8, max_length=64)
    machine_id: str = Field(min_length=8, max_length=64)


class LicenseOut(BaseModel):
    ok: bool
    active: bool
    edition: str
    holder: str
    expires_at: str | None
    activated: bool


def _to_out(lic: License, activated: bool) -> LicenseOut:
    return LicenseOut(
        ok=True,
        active=lic.status == "active" and _not_expired(lic),
        edition=lic.edition,
        holder=lic.holder,
        expires_at=lic.expires_at,
        activated=activated,
    )


def _not_expired(lic: License) -> bool:
    if not lic.expires_at:
        return True
    try:
        exp = datetime.fromisoformat(lic.expires_at)
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return exp > datetime.now(timezone.utc)
    except (TypeError, ValueError):
        # 授权时间损坏时必须按无效处理，不能 fail-open。
        return False


def _log(db: Session, key: str, machine: str, action: str, detail: str = "") -> None:
    db.add(ActivationLog(license_key=key, machine_id=machine, action=action, detail=detail))


def _claim_machine(db: Session, license_id: int, machine_id: str, activated_at: str) -> bool:
    """Atomically claim an unbound license on databases with weak row locks."""
    result = db.execute(
        update(License)
        .where(License.id == license_id, License.machine_id.is_(None))
        .values(machine_id=machine_id, activated_at=activated_at)
    )
    return result.rowcount == 1


@router.post("/activate", response_model=LicenseOut)
def activate(request: Request, body: ActivateIn, db: Session = Depends(get_db)):
    if not security.allow_shared_rate_limit(db, f"license:{request.client.host if request.client else 'unknown'}", 20, 300):
        raise HTTPException(status_code=429, detail="授权请求过于频繁，请稍后再试")
    key = body.key.strip().upper()
    # MySQL uses SELECT ... FOR UPDATE. SQLite ignores that clause, so the
    # binding below is also a conditional UPDATE and is safe on both engines.
    lic = db.query(License).filter(License.key == key).with_for_update().first()
    if not lic:
        _log(db, key, body.machine_id, "fail", "key-not-found")
        db.commit()
        raise HTTPException(status_code=400, detail="授权密钥无效")
    if lic.status == "revoked":
        _log(db, key, body.machine_id, "fail", "revoked")
        db.commit()
        raise HTTPException(status_code=400, detail="该授权已被撤销")
    if not _not_expired(lic):
        _log(db, key, body.machine_id, "fail", "expired")
        db.commit()
        raise HTTPException(status_code=400, detail="授权已过期")

    # 首次激活绑定机器；已绑定的机器可重复激活（幂等）
    if lic.machine_id and lic.machine_id != body.machine_id:
        _log(db, key, body.machine_id, "fail", "machine-mismatch")
        db.commit()
        raise HTTPException(status_code=400, detail="该授权已绑定其他设备")
    newly = not lic.machine_id
    if newly:
        if not _claim_machine(db, lic.id, body.machine_id, lic.activated_at or now_iso()):
            # Another SQLite request won the race after our non-locking read.
            db.rollback()
            current = db.query(License).filter(License.key == key).first()
            if current and current.machine_id == body.machine_id:
                return _to_out(current, activated=True)
            _log(db, key, body.machine_id, "fail", "machine-race")
            db.commit()
            raise HTTPException(status_code=400, detail="该授权已绑定其他设备")
        db.refresh(lic)
    _log(db, key, body.machine_id, "activate", "ok" if newly else "re-activate")
    db.commit()
    return _to_out(lic, activated=True)


@router.post("/check", response_model=LicenseOut)
def check(request: Request, body: ActivateIn, db: Session = Depends(get_db)):
    if not security.allow_shared_rate_limit(db, f"license:{request.client.host if request.client else 'unknown'}", 20, 300):
        raise HTTPException(status_code=429, detail="授权请求过于频繁，请稍后再试")
    key = body.key.strip().upper()
    lic = db.query(License).filter(License.key == key).first()
    if not lic:
        raise HTTPException(status_code=400, detail="授权密钥无效")
    if lic.machine_id and lic.machine_id != body.machine_id:
        _log(db, key, body.machine_id, "fail", "machine-mismatch")
        db.commit()
        raise HTTPException(status_code=400, detail="该授权已绑定其他设备")
    if lic.status == "revoked":
        _log(db, key, body.machine_id, "fail", "revoked")
        db.commit()
        raise HTTPException(status_code=400, detail="该授权已被撤销")
    if not _not_expired(lic):
        _log(db, key, body.machine_id, "fail", "expired")
        db.commit()
        raise HTTPException(status_code=400, detail="授权已过期")
    _log(db, key, body.machine_id, "check", "ok")
    db.commit()
    return _to_out(lic, activated=bool(lic.machine_id))

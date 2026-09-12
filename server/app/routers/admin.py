"""MaxLabel 云服务后端 — 管理后台路由（仅 admin 角色可访问）。

管理后台网页功能：授权密钥管理（生成/列表/撤销）、用户管理（列表/角色）、
云模板管理（列表/删除）、运行统计。
"""
from datetime import datetime, timedelta, timezone
from secrets import token_hex

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import ActivationLog, License, Template, User, get_db, now_iso
from ..auth_dependencies import current_admin
from ..schemas import (
    AdminLicenseOut,
    AdminStatsOut,
    AdminTemplateOut,
    AdminUserOut,
    LicenseGenIn,
    RoleUpdateIn,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _new_key() -> str:
    raw = token_hex(8).upper()
    return "-".join(raw[i : i + 4] for i in range(0, 16, 4))


# ---------- 统计 ----------
@router.get("/stats", response_model=AdminStatsOut)
def stats(db: Session = Depends(get_db), _: User = Depends(current_admin)):
    return AdminStatsOut(
        users=db.query(User).count(),
        licenses=db.query(License).count(),
        licenses_active=db.query(License).filter(License.status == "active").count(),
        templates=db.query(Template).count(),
        activations=db.query(ActivationLog).filter(ActivationLog.action == "activate").count(),
    )


# ---------- 授权密钥管理 ----------
@router.get("/licenses", response_model=list[AdminLicenseOut])
def list_licenses(offset: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db), _: User = Depends(current_admin)):
    rows = db.query(License).order_by(License.id.desc()).offset(offset).limit(limit).all()
    return [AdminLicenseOut(
        id=r.id, key=r.key, holder=r.holder, edition=r.edition, status=r.status,
        expires_at=r.expires_at, created_at=r.created_at, activated_at=r.activated_at,
        machine_id=r.machine_id,
    ) for r in rows]


@router.post("/licenses", response_model=AdminLicenseOut)
def create_license(body: LicenseGenIn, db: Session = Depends(get_db), _: User = Depends(current_admin)):
    key = _new_key()
    while db.query(License).filter(License.key == key).first():
        key = _new_key()
    expires = None if body.permanent else (datetime.now(timezone.utc) + timedelta(days=body.days)).isoformat()
    lic = License(key=key, holder=body.holder, edition="standard", expires_at=expires, created_at=now_iso())
    db.add(lic)
    db.commit()
    db.refresh(lic)
    return AdminLicenseOut(
        id=lic.id, key=lic.key, holder=lic.holder, edition=lic.edition, status=lic.status,
        expires_at=lic.expires_at, created_at=lic.created_at, activated_at=lic.activated_at,
        machine_id=lic.machine_id,
    )


@router.post("/licenses/{key}/revoke")
def revoke_license(key: str, db: Session = Depends(get_db), _: User = Depends(current_admin)):
    lic = db.query(License).filter(License.key == key.strip().upper()).first()
    if not lic:
        raise HTTPException(status_code=404, detail="未找到该密钥")
    lic.status = "revoked"
    db.commit()
    return {"ok": True}


# ---------- 用户管理 ----------
@router.get("/users", response_model=list[AdminUserOut])
def list_users(offset: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db), _: User = Depends(current_admin)):
    rows = db.query(User).order_by(User.id.desc()).offset(offset).limit(limit).all()
    counts = dict(db.query(Template.user_id, func.count(Template.id)).group_by(Template.user_id).all())
    return [AdminUserOut(id=u.id, email=u.email, role=u.role, created_at=u.created_at, template_count=int(counts.get(u.id, 0))) for u in rows]


@router.post("/users/{uid}/role")
def set_role(uid: int, body: RoleUpdateIn, db: Session = Depends(get_db), admin: User = Depends(current_admin)):
    role = body.role
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if user.id == admin.id and role != "admin":
        raise HTTPException(status_code=400, detail="不能撤销自己的管理员权限")
    user.role = role
    db.commit()
    return {"ok": True, "role": role}


# ---------- 云模板管理 ----------
@router.get("/templates", response_model=list[AdminTemplateOut])
def list_templates(offset: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db), _: User = Depends(current_admin)):
    rows = (
        db.query(Template, User.email)
        .join(User, Template.user_id == User.id)
        .order_by(Template.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [AdminTemplateOut(id=t.id, name=t.name, user_email=email, updated_at=t.updated_at) for t, email in rows]


@router.delete("/templates/{tid}")
def delete_template(tid: int, db: Session = Depends(get_db), _: User = Depends(current_admin)):
    t = db.query(Template).filter(Template.id == tid).first()
    if not t:
        raise HTTPException(status_code=404, detail="模板不存在")
    db.delete(t)
    db.commit()
    return {"ok": True}

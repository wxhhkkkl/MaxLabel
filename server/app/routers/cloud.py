"""MaxLabel 云服务后端 — 云服务模块路由（云模板库 CRUD）。"""
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import Template, User, get_db, now_iso
from ..auth_dependencies import current_user
from ..schemas import TemplateDetailOut, TemplateOut, TemplateSaveIn
from .. import config

router = APIRouter(prefix="/api/cloud", tags=["cloud"])


def _redact_template_data(data: str) -> str:
    """Remove database passwords at the server persistence boundary."""
    parsed = json.loads(data)
    if not isinstance(parsed, dict):
        return data
    document = parsed.get("doc") if parsed.get("format") == "maxlabel-msdx" else parsed
    if not isinstance(document, dict) or not isinstance(document.get("connections"), dict):
        return data
    redacted = False
    for connection in document["connections"].values():
        if isinstance(connection, dict) and "password" in connection:
            connection.pop("password", None)
            redacted = True
    return json.dumps(parsed, ensure_ascii=False, indent=2) if redacted else data


@router.get("/templates", response_model=list[TemplateOut])
def list_templates(offset: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500), user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(Template)
        .filter(Template.user_id == user.id)
        .order_by(Template.updated_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [TemplateOut(id=t.id, name=t.name, updated_at=t.updated_at) for t in rows]


@router.post("/templates", response_model=TemplateOut)
def save_template(
    body: TemplateSaveIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="模板名称不能为空")
    try:
        clean_data = _redact_template_data(body.data)
    except (TypeError, ValueError, RecursionError):
        # The desktop client validates before sending, but the HTTP API is also
        # a public persistence boundary and must not store malformed templates.
        raise HTTPException(status_code=400, detail="模板数据不是有效 JSON")
    existing = (
        db.query(Template)
        .filter(Template.user_id == user.id, Template.name == name)
        .first()
    )
    # size_bytes is maintained by the write path and migrated for old rows.
    # This makes the normal quota check O(1), independent of the account's
    # template count. The fallback handles a database created by an older
    # process before its first migration run.
    current_count = int(db.query(func.count(Template.id)).filter(Template.user_id == user.id).scalar() or 0)
    current_bytes = int(db.query(func.coalesce(func.sum(Template.size_bytes), 0)).filter(Template.user_id == user.id).scalar() or 0)
    if current_count and current_bytes == 0:
        legacy_rows = db.query(Template.json).filter(Template.user_id == user.id).all()
        current_bytes = sum(len(row[0].encode('utf-8')) for row in legacy_rows)
    projected_count = current_count if existing else current_count + 1
    existing_bytes = (existing.size_bytes or len(existing.json.encode('utf-8'))) if existing else 0
    projected_bytes = current_bytes - existing_bytes + len(clean_data.encode('utf-8'))
    if projected_count > config.MAX_USER_TEMPLATES:
        raise HTTPException(status_code=413, detail=f"每个账号最多保存 {config.MAX_USER_TEMPLATES} 个模板")
    if projected_bytes > config.MAX_USER_TEMPLATE_BYTES:
        raise HTTPException(status_code=413, detail="账号模板总容量超过 256 MB")
    if existing:
        existing.json = clean_data
        existing.size_bytes = len(clean_data.encode('utf-8'))
        existing.updated_at = now_iso()
        db.commit()
        db.refresh(existing)
        return TemplateOut(id=existing.id, name=existing.name, updated_at=existing.updated_at)
    t = Template(user_id=user.id, name=name, json=clean_data, size_bytes=len(clean_data.encode('utf-8')), updated_at=now_iso())
    db.add(t)
    try:
        db.commit()
    except IntegrityError:
        # 并发保存同名模板时，唯一约束是最终仲裁；回滚后转为更新，保证客户端行为稳定。
        db.rollback()
        existing = (
            db.query(Template)
            .filter(Template.user_id == user.id, Template.name == name)
            .first()
        )
        if not existing:
            raise HTTPException(status_code=409, detail="模板名称冲突，请重试")
        existing.json = clean_data
        existing.size_bytes = len(clean_data.encode('utf-8'))
        existing.updated_at = now_iso()
        db.commit()
        db.refresh(existing)
        return TemplateOut(id=existing.id, name=existing.name, updated_at=existing.updated_at)
    db.refresh(t)
    return TemplateOut(id=t.id, name=t.name, updated_at=t.updated_at)


@router.get("/templates/{tid}", response_model=TemplateDetailOut)
def load_template(
    tid: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    t = db.query(Template).filter(Template.id == tid, Template.user_id == user.id).first()
    if not t:
        raise HTTPException(status_code=404, detail="模板不存在")
    return TemplateDetailOut(id=t.id, name=t.name, data=t.json, updated_at=t.updated_at)


@router.delete("/templates/{tid}")
def delete_template(
    tid: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    t = db.query(Template).filter(Template.id == tid, Template.user_id == user.id).first()
    if not t:
        raise HTTPException(status_code=404, detail="模板不存在")
    db.delete(t)
    db.commit()
    return {"ok": True}

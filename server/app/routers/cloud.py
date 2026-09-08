"""MaxLabel 云服务后端 — 云服务模块路由（云模板库 CRUD）。"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..database import Template, User, get_db, now_iso
from ..schemas import TemplateDetailOut, TemplateOut, TemplateSaveIn

router = APIRouter(prefix="/api/cloud", tags=["cloud"])


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    from .auth import current_email

    email = current_email(request)
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="账户不存在")
    return user


@router.get("/templates", response_model=list[TemplateOut])
def list_templates(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(Template)
        .filter(Template.user_id == user.id)
        .order_by(Template.updated_at.desc())
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
    existing = (
        db.query(Template)
        .filter(Template.user_id == user.id, Template.name == name)
        .first()
    )
    if existing:
        existing.json = body.data
        existing.updated_at = now_iso()
        db.commit()
        db.refresh(existing)
        return TemplateOut(id=existing.id, name=existing.name, updated_at=existing.updated_at)
    t = Template(user_id=user.id, name=name, json=body.data, updated_at=now_iso())
    db.add(t)
    db.commit()
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

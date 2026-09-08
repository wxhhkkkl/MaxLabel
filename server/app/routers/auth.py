"""MaxLabel 云服务后端 — 用户账户模块路由（注册/登录/资料/改密/登出）。"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import security
from ..database import User, get_db
from ..schemas import AuthOut, ChangePasswordIn, LoginIn, RegisterIn, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


def current_email(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未登录或会话已过期")
    email = security.decode_token(auth[7:])
    if not email:
        raise HTTPException(status_code=401, detail="未登录或会话已过期")
    return email


@router.post("/register", response_model=AuthOut)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = str(body.email).strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="该邮箱已注册，请直接登录")
    user = User(email=email, password_hash=security.hash_password(body.password), role="user")
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthOut(token=security.create_token(email), email=email)


@router.post("/login", response_model=AuthOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    email = str(body.email).strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not security.verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=400, detail="邮箱或密码错误")
    return AuthOut(token=security.create_token(email), email=email)


@router.get("/me", response_model=UserOut)
def me(email: str = Depends(current_email), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="账户不存在")
    return UserOut(email=user.email, role=user.role, created_at=user.created_at)


@router.post("/change-password")
def change_password(
    body: ChangePasswordIn,
    email: str = Depends(current_email),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="账户不存在")
    if not security.verify_password(body.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="原密码错误")
    user.password_hash = security.hash_password(body.new_password)
    db.commit()
    return {"ok": True}


@router.post("/logout")
def logout():
    # JWT 无状态：登出由客户端清除 token；这里返回成功以便前端统一处理
    return {"ok": True}

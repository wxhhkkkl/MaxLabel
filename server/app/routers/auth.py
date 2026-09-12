"""MaxLabel 云服务后端 — 用户账户模块路由（注册/登录/资料/改密/登出）。"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import security
from ..database import User, get_db
from ..schemas import AuthOut, ChangePasswordIn, LoginIn, RegisterIn, UserOut
from ..auth_dependencies import current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _auth_response(request: Request, response: Response, email: str, token: str) -> AuthOut:
    # The Electron client still receives a bearer token.  The bundled web
    # frontend uses an HttpOnly cookie so an XSS payload cannot read the JWT.
    if request.headers.get("X-MaxLabel-Client") == "web":
        security.set_auth_cookie(response, token)
        return AuthOut(token="", email=email)
    return AuthOut(token=token, email=email)


@router.post("/register", response_model=AuthOut)
def register(request: Request, response: Response, body: RegisterIn, db: Session = Depends(get_db)):
    if not security.allow_shared_rate_limit(db, f"register:{request.client.host if request.client else 'unknown'}", 5, 3600):
        raise HTTPException(status_code=429, detail="注册请求过于频繁，请稍后再试")
    email = str(body.email).strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="该邮箱已注册，请直接登录")
    user = User(email=email, password_hash=security.hash_password(body.password), role="user")
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="该邮箱已注册，请直接登录")
    db.refresh(user)
    return _auth_response(request, response, email, security.create_token(email, user.token_version))


@router.post("/login", response_model=AuthOut)
def login(request: Request, response: Response, body: LoginIn, db: Session = Depends(get_db)):
    if not security.allow_shared_rate_limit(db, f"login:{request.client.host if request.client else 'unknown'}", 10, 300):
        raise HTTPException(status_code=429, detail="登录请求过于频繁，请稍后再试")
    email = str(body.email).strip().lower()
    if not security.allow_shared_rate_limit(db, f"login-email:{email}", 10, 300):
        raise HTTPException(status_code=429, detail="该账户登录失败次数过多，请稍后再试")
    user = db.query(User).filter(User.email == email).first()
    if not user or not security.verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=400, detail="邮箱或密码错误")
    return _auth_response(request, response, email, security.create_token(email, user.token_version))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return UserOut(email=user.email, role=user.role, created_at=user.created_at)


@router.post("/change-password")
def change_password(
    body: ChangePasswordIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if not security.verify_password(body.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="原密码错误")
    user.password_hash = security.hash_password(body.new_password)
    user.token_version = int(user.token_version or 0) + 1
    db.commit()
    return {"ok": True}


@router.post("/logout")
def logout(response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    user.token_version = int(user.token_version or 0) + 1
    db.commit()
    security.clear_auth_cookie(response)
    return {"ok": True}

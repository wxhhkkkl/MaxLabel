"""Shared FastAPI authentication dependencies for user and admin routes."""

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from . import security
from .database import User, get_db


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    auth = request.headers.get("Authorization", "")
    bearer = auth.startswith("Bearer ")
    token = auth[7:].strip() if bearer else request.cookies.get(security.AUTH_COOKIE, "")
    if not token:
        raise HTTPException(status_code=401, detail="未登录或会话已过期")
    if not bearer and request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        security.require_csrf(request)
    email = security.decode_token(token)
    version = security.token_version(token)
    if not email or version < 0:
        raise HTTPException(status_code=401, detail="未登录或会话已过期")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="账户不存在")
    if version != int(user.token_version or 0):
        raise HTTPException(status_code=401, detail="未登录或会话已过期")
    return user


def current_email(user: User = Depends(current_user)) -> str:
    return user.email


def current_admin(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user

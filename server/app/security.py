"""MaxLabel 云服务后端 — 安全：bcrypt 密码哈希 + JWT。"""
from datetime import datetime, timedelta, timezone
from collections import defaultdict, deque
import secrets
from threading import Lock
import time

import bcrypt
import jwt
from fastapi import HTTPException, Request, Response
from sqlalchemy import case
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from . import config
from .database import RateLimitBucket, USE_MYSQL

_RATE_LIMIT_LOCK = Lock()
_RATE_LIMIT_EVENTS: dict[str, deque[float]] = defaultdict(deque)
_RATE_LIMIT_CLEANUP_AT = 0.0


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_token(email: str, token_version: int = 0) -> str:
    payload = {
        "sub": email,
        "ver": int(token_version),
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=config.JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALG)


AUTH_COOKIE = "maxlabel_session"
CSRF_COOKIE = "maxlabel_csrf"


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        AUTH_COOKIE,
        token,
        max_age=config.JWT_EXPIRE_HOURS * 3600,
        httponly=True,
        secure=config.ENV == "production",
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        CSRF_COOKIE,
        secrets.token_urlsafe(32),
        max_age=config.JWT_EXPIRE_HOURS * 3600,
        httponly=False,
        secure=config.ENV == "production",
        samesite="lax",
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(AUTH_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")


def require_csrf(request: Request) -> None:
    """Protect state-changing cookie-authenticated requests from CSRF."""
    cookie = request.cookies.get(CSRF_COOKIE, "")
    header = request.headers.get("X-MaxLabel-CSRF", "")
    try:
        valid = bool(cookie and header and secrets.compare_digest(cookie, header))
    except TypeError:
        valid = False
    if not valid:
        raise HTTPException(status_code=403, detail="CSRF 校验失败，请刷新页面后重试")


def decode_token(token: str) -> str | None:
    """返回 email；无效/过期返回 None。"""
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALG])
        subject = payload.get("sub")
        return subject if isinstance(subject, str) and subject else None
    except jwt.PyJWTError:
        return None


def token_version(token: str) -> int:
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALG])
        value = payload.get("ver", 0)
        return int(value) if isinstance(value, (int, float)) else 0
    except (jwt.PyJWTError, ValueError, TypeError):
        return -1


def allow_rate_limit(key: str, limit: int, window_seconds: int) -> bool:
    """Process-local fallback used only when the shared bucket is unavailable."""
    now = time.monotonic()
    with _RATE_LIMIT_LOCK:
        events = _RATE_LIMIT_EVENTS[key]
        while events and now - events[0] >= window_seconds:
            events.popleft()
        if len(events) >= limit:
            return False
        events.append(now)
        if len(_RATE_LIMIT_EVENTS) > 10000:
            for stale in [name for name, values in _RATE_LIMIT_EVENTS.items() if not values or now - values[-1] >= window_seconds]:
                _RATE_LIMIT_EVENTS.pop(stale, None)
        return True


def allow_shared_rate_limit(db: Session, key: str, limit: int, window_seconds: int) -> bool:
    """Atomically increment a database-backed fixed-window rate-limit bucket.

    The upsert is performed by the database so two service workers cannot both
    observe the same old counter and admit an extra request.  If an old/custom
    database cannot create or update the bucket, fall back to the process-local
    guard so a transient migration mismatch does not make the whole service
    unusable; production deployments should additionally enforce an edge limit.
    """
    if limit <= 0 or window_seconds <= 0:
        return False
    now = int(time.time())
    cutoff = now - int(window_seconds)
    try:
        values = {
            RateLimitBucket.bucket_key: key[:512],
            RateLimitBucket.window_started: now,
            RateLimitBucket.hit_count: 1,
            RateLimitBucket.updated_at: now,
        }
        expired = RateLimitBucket.window_started <= cutoff
        next_window = case((expired, now), else_=RateLimitBucket.window_started)
        next_count = case(
            (expired, 1),
            (RateLimitBucket.hit_count >= limit, limit + 1),
            else_=RateLimitBucket.hit_count + 1,
        )
        if USE_MYSQL:
            from sqlalchemy.dialects.mysql import insert

            statement = insert(RateLimitBucket).values(values).on_duplicate_key_update(
                window_started=next_window,
                hit_count=next_count,
                updated_at=now,
            )
        else:
            from sqlalchemy.dialects.sqlite import insert

            statement = insert(RateLimitBucket).values(values).on_conflict_do_update(
                index_elements=[RateLimitBucket.bucket_key],
                set_={
                    "window_started": next_window,
                    "hit_count": next_count,
                    "updated_at": now,
                },
            )
        db.execute(statement)
        bucket = db.query(RateLimitBucket).filter(RateLimitBucket.bucket_key == key[:512]).first()
        allowed = bool(bucket and bucket.hit_count <= limit)
        db.commit()
        _cleanup_rate_limit_buckets(db, now)
        return allowed
    except SQLAlchemyError:
        db.rollback()
        return allow_rate_limit(key, limit, window_seconds)


def _cleanup_rate_limit_buckets(db: Session, now: int) -> None:
    """Bound attacker-controlled bucket growth without a cleanup per request."""
    global _RATE_LIMIT_CLEANUP_AT
    with _RATE_LIMIT_LOCK:
        if now - _RATE_LIMIT_CLEANUP_AT < 3600:
            return
        _RATE_LIMIT_CLEANUP_AT = float(now)
    try:
        db.query(RateLimitBucket).filter(RateLimitBucket.updated_at < now - 86400).delete(synchronize_session=False)
        db.commit()
    except SQLAlchemyError:
        db.rollback()

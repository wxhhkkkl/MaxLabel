"""MaxLabel 云服务后端 — Pydantic 请求/响应模型。"""
from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class AuthOut(BaseModel):
    token: str
    email: str


class ChangePasswordIn(BaseModel):
    old_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)


class UserOut(BaseModel):
    email: str
    role: str
    created_at: str


class TemplateSaveIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    data: str = Field(default="", max_length=16 * 1024 * 1024)


class TemplateOut(BaseModel):
    id: int
    name: str
    updated_at: str


class TemplateDetailOut(TemplateOut):
    data: str


# ---------- 管理后台 ----------
class LicenseGenIn(BaseModel):
    days: int = Field(default=365, ge=1, le=36500)
    permanent: bool = False
    holder: str = Field(default="", max_length=255)


class AdminLicenseOut(BaseModel):
    id: int
    key: str
    holder: str
    edition: str
    status: str
    expires_at: str | None
    created_at: str
    activated_at: str | None
    machine_id: str | None


class RoleUpdateIn(BaseModel):
    role: str = Field(pattern="^(user|admin)$")


class AdminUserOut(BaseModel):
    id: int
    email: str
    role: str
    created_at: str
    template_count: int


class AdminTemplateOut(BaseModel):
    id: int
    name: str
    user_email: str
    updated_at: str


class AdminStatsOut(BaseModel):
    users: int
    licenses: int
    licenses_active: int
    templates: int
    activations: int

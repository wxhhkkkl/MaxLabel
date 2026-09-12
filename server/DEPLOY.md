# MaxLabel 云服务 — 部署与使用说明

云服务是独立部署在**您自己的服务器**上的 FastAPI + Vue 应用。客户拿到的 MaxLabel 客户端

通过网络连接本服务，完成 **在线授权鉴权（license）**、**用户账户** 与 **云存储（云端模板）**。

## 一、目录结构



```
server/

├── app/                  # FastAPI 后端

│   ├── main.py           # 入口（挂载所有路由 + Vue 静态资源）

│   ├── config.py         # 端口 / 数据库路径 / JWT 密钥

│   ├── database.py       # 数据模型（users / templates / licenses / activation_logs / rate_limit_buckets）
│                     #   支持 MySQL（腾讯云等，推荐生产）与 SQLite（本地回退）

│   ├── security.py       # bcrypt 密码哈希 + JWT

│   ├── routers/

│   │   ├── auth.py       # /api/auth/\*      注册、登录、资料、改密

│   │   ├── cloud.py      # /api/cloud/\*    云端模板 保存/列表/加载/删除

│   │   ├── license.py    # /api/license/\*  激活、启动复查（绑定机器码）

│   │   └── admin.py      # /api/admin/\*    管理后台（仅管理员）

│   └── scripts/

│       ├── gen\_license.py   # 命令行生成/撤销授权密钥

│       └── make\_admin.py    # 把指定用户设为管理员

├── frontend/             # Vue 3 前端源码（登录/账户/云服务/管理后台）

├── static/               # 前端构建产物（FastAPI 直接托管，含管理后台）

├── .env                  # 数据库配置（host/port/账号/密码/库名）
├── data/                 # SQLite 数据库文件（仅本地回退模式使用）

└── requirements.txt      # Python 依赖
```

## 二、数据库配置（腾讯云 MySQL）

服务支持 MySQL（生产推荐）与 SQLite（本地回退），配置写在 `server/.env`：

```dotenv
MAXLABEL_DB_DRIVER=mysql
MAXLABEL_DB_HOST=bj-cdb-g04f44o8.sql.tencentcdb.com
MAXLABEL_DB_PORT=22326
MAXLABEL_DB_USER=maxlabel
MAXLABEL_DB_PASSWORD=你的数据库密码
MAXLABEL_DB_NAME=maxlabel
MAXLABEL_DB_AUTO_CREATE=0
MAXLABEL_CLOUD_ENV=production
MAXLABEL_CLOUD_HOST=0.0.0.0
MAXLABEL_CLOUD_SECRET=至少32位随机字符串
MAXLABEL_CLOUD_ORIGINS=https://cloud.yourdomain.com
```

- 生产环境建议由 DBA 预创建数据库和最小权限账号；只有显式设置 `MAXLABEL_DB_AUTO_CREATE=1` 时才会尝试自动建库。
- `MAXLABEL_DB_DRIVER=mysql` 时必须配置 `MAXLABEL_DB_PASSWORD`，否则服务启动会直接失败，不会静默改用 SQLite。
- 未设置 `MAXLABEL_CLOUD_ENV=production` 时适合本机调试：默认使用 SQLite（server/data/maxlabel-cloud.db）。
- 生产环境必须设置随机 JWT 密钥、非回环监听地址；`MAXLABEL_CLOUD_ORIGINS` 只填写实际客户端/管理后台来源，留空表示同源部署。
- 也可用环境变量覆盖同名配置（环境变量优先于 .env）。
- 启动时会打印当前 DB 模式：“DB mode: MySQL <host>”或“SQLite (local)”。
- 服务启动会执行带版本号的幂等迁移；如果数据库版本高于当前服务，服务会拒绝启动，避免新旧代码写坏数据。

## 三、服务器部署（首次）

环境要求：Python 3.10+（建议 3.12）。



```
# 1. 安装依赖

pip install -r requirements.txt

# 2. 启动服务（生产建议用 systemd / supervisor / docker 守护）

python -m app.main

# 可选：修改配置

#   或通过环境变量设置 MAXLABEL_CLOUD_PORT / MAXLABEL_CLOUD_HOST /
#   MAXLABEL_CLOUD_SECRET / MAXLABEL_CLOUD_ORIGINS

#   或通过环境变量覆盖：MAXLABEL_CLOUD_PORT / MAXLABEL_CLOUD_DATA
```

> 前端（含管理后台）由 `server/frontend` 构建到
>
> `server/static/`
>
> ，运行服务时不需要单独部署 Node。源码部署首次启动会自动构建；也可以手动执行：
>
> `cd server/frontend && npm ci && npm run build`
>
> 发布 PyInstaller 服务端前，必须先完成该构建，否则 `cloud-server.spec` 无法把静态资源打入安装包。

建议在服务器前面加 Nginx/Caddy 做 HTTPS（客户端连服务器走 HTTPS 更安全）：



```
location / { proxy\_pass http://127.0.0.1:8420; }
```

生产反向代理还应配置登录、注册和授权接口的按 IP 限流。应用内置的是同库共享的固定窗口限流（单机多进程可共享），数据库不可用时才回退到进程级限流；多实例跨库部署仍必须使用 Redis/WAF/网关限流。

## 四、初始化管理员（重要）

首次启动后，先在网页注册一个账户（如 admin@yourdomain.com），然后：



```
python -m app.scripts.make\_admin --email admin@yourdomain.com
```

该账户登录后顶部导航会出现「管理后台」入口。

## 五、管理后台功能（登录后 → 管理后台）



| 页面   | 功能                                          |
| ---- | ------------------------------------------- |
| 概览统计 | 注册用户数、授权密钥总数 / 有效数、云端模板数、激活次数               |
| 授权密钥 | 生成 MaxLabel 单一产品授权密钥（时长：30 天～永久；持有人备注）、一键复制、撤销 |
| 用户管理 | 查看用户、把用户设为管理员 / 降为普通用户                      |
| 云模板  | 查看所有用户上传的云端模板，违规可删除                         |

**密钥发放流程**：管理后台生成密钥 → 复制发给客户 → 客户在 MaxLabel 的

「账户 → 授权」填入服务器地址 + 密钥 → 激活成功即绑定客户机器（一机一码）。

客户换电脑需在管理后台将旧密钥撤销后重新生成，或在后续版本中做解绑功能。

## 六、与客户端对接

客户端「系统选项 → 通用 → 云服务器地址」填写：



* 本机调试：`http://127.0.0.1:8420`

* 正式部署：`https://cloud.yourdomain.com`（服务器地址）

客户端在「系统选项 → 通用 → 云服务器地址」中统一配置；“分享”使用同一地址的内置云模板库，账户/云服务菜单仍可打开完整 Web 云服务窗口。

## 七、常用命令速查



```
# 启动

python -m app.main

# 生成密钥（命令行方式）

python -m app.scripts.gen_license generate --days 365 --holder "客户名"

python -m app.scripts.gen_license generate --permanent --holder "客户A"

# 查看 / 撤销密钥

python -m app.scripts.gen_license list

# 撤销密钥
python -m app.scripts.gen_license revoke --key XXXX-XXXX-XXXX-XXXX

# 设置管理员

python -m app.scripts.make_admin --email admin@yourdomain.com
```

## 八、API 一览（客户端 / 管理端）



```
POST /api/auth/register           注册（返回 JWT）

POST /api/auth/login              登录

GET  /api/auth/me                 当前用户资料（含角色）

POST /api/auth/change-password    修改密码

POST /api/auth/logout             注销并立即使当前 Token 失效

POST /api/license/activate        激活（key + machine\_id，绑定机器）

POST /api/license/check           启动复查（key + machine\_id）

GET/POST/DELETE /api/cloud/templates  云端模板（需登录）

GET  /api/admin/stats             统计

GET  /api/admin/licenses          密钥列表

POST /api/admin/licenses          生成密钥

POST /api/admin/licenses/{key}/revoke  撤销

GET  /api/admin/users             用户列表

POST /api/admin/users/{id}/role   设置角色

GET  /api/admin/templates         云模板列表

DELETE /api/admin/templates/{id}  删除模板
```

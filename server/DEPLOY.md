# MaxLabel 云服务 — 部署与使用说明

云服务是独立部署在**您自己的服务器**上的 FastAPI + Vue 应用。客户拿到的 MaxLabel 客户端

通过网络连接本服务，完成 **在线授权鉴权（license）**、**用户账户** 与 **云存储（云端模板）**。

## 一、目录结构



```
server/

├── app/                  # FastAPI 后端

│   ├── main.py           # 入口（挂载所有路由 + Vue 静态资源）

│   ├── config.py         # 端口 / 数据库路径 / JWT 密钥

│   ├── database.py       # 数据模型（users / templates / licenses / activation_logs）
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

服务支持 MySQL（生产推荐）与 SQLite（本地回退），配置写在 \server/.env\：

\MAXLABEL_DB_DRIVER=mysql
MAXLABEL_DB_HOST=bj-cdb-g04f44o8.sql.tencentcdb.com
MAXLABEL_DB_PORT=22326
MAXLABEL_DB_USER=root
MAXLABEL_DB_PASSWORD=你的数据库密码
MAXLABEL_DB_NAME=maxlabel
\
- 填入 \MAXLABEL_DB_PASSWORD\ 后重启服务即连接腾讯云 MySQL；服务会自动创建 \maxlabel\ 库（root 权限）并建表/轻量迁移，旧库判断表结构后自动补列。
- 密码留空时自动回退本地 SQLite（server/data/maxlabel-cloud.db），适合调试。
- 也可用环境变量覆盖同名配置（环境变量优先于 .env）。
- 启动时会打印当前 DB 模式：“DB mode: MySQL <host>”或“SQLite (local)”。

## 二、服务器部署（首次）

环境要求：Python 3.10+（建议 3.12）。



```
\# 1. 安装依赖

pip install -r requirements.txt

\# 2. 启动服务（生产建议用 systemd / supervisor / docker 守护）

python -m uvicorn app.main:app --host 0.0.0.0 --port 8420

\# 可选：修改配置

\#   server/app/config.py 中 PORT / JWT\_SECRET（务必改成自己的随机值）

\#   或通过环境变量覆盖：MAXLABEL\_CLOUD\_PORT / MAXLABEL\_CLOUD\_DATA
```

> 前端（含管理后台）已构建在 
>
> `server/static/`
>
> ，无需单独部署 Node。
> 如需修改前端，在 
>
> `server/frontend/`
>
>  改源码后执行 
>
> `npm install && npm run build`
>
> 。

建议在服务器前面加 Nginx/Caddy 做 HTTPS（客户端连服务器走 HTTPS 更安全）：



```
location / { proxy\_pass http://127.0.0.1:8420; }
```

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
| 授权密钥 | 生成密钥（版本：专业版 / 企业版；时长：30 天～永久；持有人备注）、一键复制、撤销 |
| 用户管理 | 查看用户、把用户设为管理员 / 降为普通用户                      |
| 云模板  | 查看所有用户上传的云端模板，违规可删除                         |

**密钥发放流程**：管理后台生成密钥 → 复制发给客户 → 客户在 MaxLabel 的

「账户 → 账号和授权管理」填入服务器地址 + 密钥 → 激活成功即绑定客户机器（一机一码）。

客户换电脑需在管理后台将旧密钥撤销后重新生成，或在后续版本中做解绑功能。

## 六、与客户端对接

客户端「系统选项 → 通用 → 云服务器地址」填写：



* 本机调试：`http://127.0.0.1:8420`

* 正式部署：`https://cloud.yourdomain.com`（服务器地址）

也可在打包前修改客户端默认值：

`app/src/renderer/src/App.tsx` 中 `openCloud()` 与 `LicenseDialog.tsx` 的默认地址。

## 七、常用命令速查



```
\# 启动

python -m uvicorn app.main:app --host 0.0.0.0 --port 8420

\# 生成密钥（命令行方式）

python -m app.scripts.gen\_license generate --edition pro --days 365 --holder "客户名"

python -m app.scripts.gen\_license generate --edition enterprise --permanent --holder "企业A"

\# 查看 / 撤销密钥

python -m app.scripts.gen\_license list

python -m app.scripts.gen\_license revoke --key XXXX-XXXX-XXXX-XXXX

\# 设置管理员

python -m app.scripts.make\_admin --email admin@yourdomain.com
```

## 八、API 一览（客户端 / 管理端）



```
POST /api/auth/register           注册（返回 JWT）

POST /api/auth/login              登录

GET  /api/auth/me                 当前用户资料（含角色）

POST /api/auth/change-password    修改密码

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
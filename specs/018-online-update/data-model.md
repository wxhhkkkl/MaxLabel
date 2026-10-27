# Data Model: 桌面端在线更新链路

**Feature**: `018-online-update` | **Date**: 2026-10-27

## 1. 本地更新设置

### AppOptions（现有，localStorage）

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `updateCheckOnStartup` | boolean | `true` | 启动时是否检查更新。`false` 表示不发起启动检查、不提示；手动检查不受影响。设置 UI 以「不提示更新」呈现（勾选 = `false`）。 |

- 由 `loadOptions`/`saveOptions` 持久化；跨重启与更新保留。
- 不写入模板、文档或 `app-config.json`。
- 旧配置缺失该字段时按默认 `true` 处理（`normalizeAppOptions` 兼容）。

## 2. 更新检查结果（IPC `update:check` 返回）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `status` | `'update' \| 'latest' \| 'unavailable'` | 是 | 有新版本 / 已是最新 / 取不到或无法识别 |
| `current` | string | 是 | 当前版本（规范化后的数字版本） |
| `latest` | string? | 否 | 更新源提供的最新稳定版本 |
| `notes` | string? | 否 | 发布说明；缺失时 UI 省略 |
| `releaseDate` | string? | 否 | 发布时间（ISO 字符串），用于展示 |
| `message` | string? | 否 | 失败原因（手动检查展示；启动检查静默） |
| `messageKey` | string? | 否 | 可本地化的错误键 |

规则：
- `status='update'` 仅当 `latest` 严格大于 `current`。
- 相同/更低版本按 `latest` 处理，不提供降级。
- 预发布版本不作为正式更新。
- 启动检查失败时 UI 不弹框；手动检查必须展示 `message`/`messageKey`。

## 3. 更新状态（主进程 → 渲染层 `update:changed` / `update:state`）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `state` | `'idle' \| 'checking' \| 'available' \| 'latest' \| 'downloading' \| 'ready' \| 'installing' \| 'error'` | 是 | 当前状态 |
| `current` | string | 是 | 当前版本 |
| `latest` | string? | 否 | 可更新版本 |
| `notes` | string? | 否 | 发布说明 |
| `releaseDate` | string? | 否 | 发布时间 |
| `progress` | UpdateProgress? | 否 | 下载中/完成时的进度快照 |
| `error` | string? | 否 | 可读错误（不包含敏感凭据） |
| `messageKey` | string? | 否 | 可本地化错误键 |

### UpdateProgress

| 字段 | 类型 | 说明 |
|------|------|------|
| `percent` | number | 0–100，保留一位小数 |
| `transferred` | number | 已下载字节数 |
| `total` | number | 总字节数（未知时为 0） |
| `bytesPerSecond` | number | 当前速度（未知时为 0） |

## 4. 更新源清单 / 更新清单（feed / latest*.yml，外部）

`latest.yml` / `latest-mac.yml` / `latest-linux.yml` 由 `electron-builder` 生成，至少包含：

| 字段 | 说明 |
|------|------|
| `version` | 最新稳定版本号 |
| `files[].url` | 安装包相对路径 |
| `files[].sha512` | 安装包 SHA-512 |
| `files[].size` | 安装包字节数 |
| `path` | 主安装包路径 |
| `releaseDate` | 发布时间 |
| `releaseNotes` | 发布说明（可选） |

- 客户端只消费固定 feed；不把用户输入拼进 feed URL。
- `app-update.yml` 由打包生成并放入应用资源，包含 provider/url；打包构建不读取运行时覆盖。
- 旧版 `/api/version` JSON（`version`/`url`/`notes`）仅作迁移，不进入新客户端检查链路。

## 5. 状态机

```text
idle
 └─ update:check ──> checking
      ├─ latest ─────> latest (无提示；手动检查显示“已是最新”)
      ├─ unavailable ─> error/unavailable (启动静默；手动显示失败)
      └─ update ─────> available
available
 ├─ update:download ─> downloading
 └─ 用户稍后 ────────> available (关闭提示，保持可再次更新)
downloading
 ├─ progress ────────> downloading (更新进度)
 ├─ update:cancel ───> available (停止；不安装)
 ├─ 下载失败 ────────> error (可重试)
 └─ 下载完成+校验通过 ─> ready
ready
 ├─ 用户/自动准备安装 ─> 未保存守卫
 │    ├─ 通过 ───────> installing -> (应用重启)
 │    └─ 取消/打印中 ─> ready (保留已下载包，稍后可重启)
 └─ 不安装/退出 ─────> ready (下次启动重新检查)
installing
 └─ quitAndInstall 成功 -> 应用重启
error
 └─ 重试 ───────────> checking / available
```

规则：
- `update:download` 只允许从 `available` 进入；重复调用幂等。
- `update:install` 只允许从 `ready` 进入；主进程设置 `allowMainWindowClose` 后调用 `quitAndInstall`；重复调用直接返回已安装/进行中。
- 取消/失败不得把状态标成 `ready`；不得执行安装。
- 启动检查与手动检查重叠时共用一个状态机，不产生第二个检查会话。
- 应用重启后状态回到 `idle`；已下载但未安装的包由 electron-updater 缓存管理，下次检查重新判定。

## 6. 数据与文件边界

- **不修改**：模板/文档格式、数据库、授权数据、用户业务文件。
- **新增/使用**：
  - `AppOptions.updateCheckOnStartup`（localStorage）
  - electron-updater 下载缓存（用户数据目录/更新缓存）
  - 打包资源中的 `app-update.yml`
- **不记录**：账号密码、授权令牌、完整手机号等敏感信息；更新日志只记录版本、状态、错误摘要。

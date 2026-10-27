# Contract: 更新源（generic feed）

**Version**: 1 | **Feature**: `018-online-update` | **Date**: 2026-10-27

## 1. 位置与固定 URL

```text
https://new.yuwangchenfa.com/updates/
├── latest.yml                  # Windows NSIS
├── latest-mac.yml              # macOS zip
├── latest-linux.yml            # Linux AppImage
├── MaxLabel-Setup-1.0.23.exe
├── MaxLabel-Setup-1.0.23.exe.blockmap
├── MaxLabel-1.0.23-x64-mac.zip
├── MaxLabel-1.0.23-x64-mac.zip.blockmap
├── MaxLabel-1.0.23-x64.dmg     # 手动安装，供下载页/老客户端
├── MaxLabel-1.0.23-x64.AppImage
├── MaxLabel-1.0.23-x64.AppImage.blockmap
└── MaxLabel-1.0.23-x64.deb     # 手动安装
```

- 打包应用通过 `electron-builder` 生成的 `app-update.yml` 读取该 URL；不在运行时接受用户输入。
- 旧版迁移入口：`https://new.yuwangchenfa.com/api/version` 返回静态 JSON：
  ```json
  { "version": "1.0.23", "url": "https://new.yuwangchenfa.com/updates/MaxLabel-Setup-1.0.23.exe", "notes": "..." }
  ```
  该 JSON 只服务 ≤1.0.22 的旧客户端；新客户端不读取。
- 发布目录由 nginx 静态提供；不新增后端接口。

## 2. `latest*.yml` 必需字段

由 `electron-builder` 生成，至少包含：

| 字段 | 必填 | 说明 |
|------|------|------|
| `version` | 是 | 最新稳定版本号（如 `1.0.23`） |
| `files[].url` | 是 | 安装包相对路径 |
| `files[].sha512` | 是 | 安装包 SHA-512（Base64） |
| `files[].size` | 是 | 安装包字节数 |
| `path` | 是 | 主安装包相对路径 |
| `releaseDate` | 否 | 发布时间（ISO） |
| `releaseNotes` | 否 | 发布说明纯文本/HTML，客户端按纯文本展示 |

规则：
- 版本必须是稳定数字版本（可带 `v` 前缀但会被规范化）；预发布版本不得作为正式更新。
- `sha512` 缺失或与下载文件不一致 → 拒绝安装（FR-009/018）。
- `url`/`path` 只允许同一更新源下的相对路径；不得指向其他域名。
- 相同/更低版本不得进入 `latest*.yml`；服务端发布前校验。

## 3. 三端产物

| 平台 | 安装/更新产物 | 更新方式 |
|------|----------------|----------|
| Windows | NSIS `.exe` + `.blockmap` | electron-updater NSIS，用户确认后下载、安装、重启 |
| macOS | `.zip`（自动更新）+ `.dmg`（手动） | electron-updater macOS；必须签名并公证 |
| Linux | `.AppImage`（自动更新）+ `.deb`（手动） | electron-updater AppImage；AppImage 需可执行权限 |

- 差分下载（blockmap）可作为优化启用；本期验收以全量包为准，差分不得改变用户体验/失败处理。
- macOS 自动更新要求 zip 产物与签名/公证；dmg 只用于手动安装。
- Linux deb 不参与自动更新，仅供手动安装。

## 4. 发布流程

1. 提升 `app/package.json` 版本号（例：1.0.22 → 1.0.23）。
2. 构建三端产物（`electron-builder`，`--publish never`）；确认 `latest*.yml`、`app-update.yml`、`.blockmap` 均生成。
3. `publish-update.cjs` 校验：
   - `latest*.yml` 的 `version`/`sha512`/`size` 与安装包一致
   - 所有 `url`/`path` 都位于更新源内
   - 三端产物齐全（或明确声明某端暂不发布）
4. 上传安装包与元数据到 `/updates/`；先传产物，最后原子更新 `latest*.yml`，避免客户端读到不完整版本。
5. 验证 feed 可访问且 SHA-512 可下载校验；再更新旧版 `/api/version` 迁移 JSON。
6. 保留上一版本安装包与 `latest*.yml` 历史，供手动回退。

## 5. 签名与信任

- **Windows**：安装包必须代码签名；发布证书 subject 与 `electron-builder` 配置一致。未签名包不得进入正式 feed。
- **macOS**：应用与更新 zip 必须签名并公证；否则 Gatekeeper/公证会拦截。
- **Linux**：AppImage 以 SHA-512 校验为主；发布页可同时提供校验和。
- feed 只通过 HTTPS 提供；客户端拒绝非受信任来源、异常跳转或校验失败的包。
- 开发/自动化：非打包构建可用 `MAXLABEL_UPDATE_URL` 指向本地静态 feed；打包构建忽略该覆盖，只使用 `app-update.yml`。

## 6. 迁移

- 1.0.22 及更早版本没有 `electron-updater`，无法自动升级到 1.0.23；需通过 `/api/version` 或官网手动下载 1.0.23 安装一次。
- 1.0.23 起进入自动更新链路；后续版本通过 `latest*.yml` 自动发现/下载/安装。
- 旧 `/api/version` JSON 可在 1.0.23 普遍安装后下线；下线前保留静态文件，避免老用户失去手动入口。

## 7. 失败处理（源侧）

- feed 缺失/格式错误：客户端启动静默、手动检查显示“更新信息无法识别”。
- 安装包 404/大小不符/SHA-512 不符：客户端拒绝安装，保留当前版本，提示校验/下载失败。
- 同一版本重复发布：客户端按 `latest` 处理，不重复提示。
- 回滚：保留上一版本产物与元数据；客户端不自动回滚，按 `quickstart.md` 手动重装上一版本。

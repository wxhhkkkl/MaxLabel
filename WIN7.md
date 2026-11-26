# MaxLabel Win7 32 位分支（legacy/win7-32）

该分支从 `main` 的 `d25d31c`（1.2.5）拉出，当前版本 1.2.9，目标是 Windows 7 SP1 32 位。
它**不包含**主线工作区里尚未提交的条码/对比修复；这些改动合并进 `main` 后再同步本分支。

## 产品身份（与主线共存）

| 项 | 主线 | Win7 32 位 |
| --- | --- | --- |
| Electron | 44.x | 22.3.27 |
| 架构 | x64 | ia32 |
| appId | `com.maxlabel.app` | `com.maxlabel.app.win7` |
| productName | MaxLabel | MaxLabel Win7 |
| 安装目录 | `%LOCALAPPDATA%\Programs\MaxLabel` | `%LOCALAPPDATA%\Programs\MaxLabel Win7` |
| userData | `%APPDATA%\MaxLabel` | `%APPDATA%\MaxLabelWin7` |
| 更新目录 | `/updates/` | `/updates/win7/` |
| 更新缓存 | `maxlabel-updater` | `maxlabel-win7-updater` |
| NSIS 快捷方式 | MaxLabel | MaxLabel Win7 |

主线与 Win7 版可以同时安装，安装目录、数据目录、更新源和更新缓存互不覆盖。

## 已做的兼容改动

- Electron `22.3.27`（最后支持 Win7/8/8.1 的版本），`electron-builder` 26 打包 ia32 NSIS。
- Vite/electron-vite 构建目标：主进程/preload `node16`，渲染进程 `chrome108`。
- `serialport` 12（13 要求 Node 20；12 支持 Node 16），使用 `win32-ia32` N-API 预编译。
- `usb` 使用自带 `win32-ia32` N-API 预编译。
- `koffi` 额外安装 `@koromix/koffi-win32-ia32@3.3.8`，asarUnpack 已包含。
- 移除 Electron 22 不存在的 API：`ClipboardItem`、`webUtils`、`protocol.handle`/`session.fetch`（测试）、`SafeStorage.getSelectedStorageBackend` 可选化、旧版 `did-start-navigation` 签名。
- 文件拖拽路径回退到 Electron 22 的 `File.path`。
- 打印枚举/队列/加密狗：`Get-Printer`/`Get-CimInstance`/`Get-PnpDevice`/`ConvertTo-Json` 改为 Win7 可用的 `Get-WmiObject` + 制表符文本；USB 队列创建在 Win7 用 `printui.dll,PrintUIEntry`，Win8+ 仍优先 WMI/PrintUI 兼容路径。
- userData 显式隔离到 `%APPDATA%\MaxLabelWin7`，测试时尊重 `APPDATA` 临时目录。

## 构建

```bash
cd app
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
npm install --no-save --force @koromix/koffi-win32-ia32@3.3.8
npm run build
# 无证书本地验证
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ \
CSC_IDENTITY_AUTO_DISCOVERY=false \
npx electron-builder --win nsis --ia32 --publish never --config.forceCodeSigning=false
```

产物：

- `app/release-win7/MaxLabel-Win7-Setup-1.2.9.exe`（ia32）
- `app/release-win7/latest.yml`（对应 `/updates/win7/`）
- `app/release-win7/win-ia32-unpacked/`（可独立启动）

`npm run build:win` 仍用于正式签名构建；`build:win:unsigned` 仅本地验证。

## 已验证

- `npm test`：typecheck + **1609 passed / 1 skipped**（2026-11-26 合并 main 1.2.9 后）。
- E2E：`spike` + `start-page-entitlement` **15 passed**（Electron 22 x64 测试运行时）。
- 打包后的 ia32 应用在 Windows 11 x64（WOW64）启动成功，渲染页加载，userData 为隔离目录。
- 安装包/解包目录中确认存在：
  - `@serialport/bindings-cpp/prebuilds/win32-ia32/node.napi.node`
  - `usb/prebuilds/win32-ia32/node.napi.node`
  - `@koromix/koffi-win32-ia32/win32_ia32/koffi.node`

## 功能限制

- **SQLite 数据源不可用**：实现依赖 Electron 44/Node 22 的 `node:sqlite`，Electron 22/Node 16 没有该模块。
- **SQL Server / DSN（ODBC）**：PowerShell 脚本使用 `ConvertFrom-Json`/`::new`，要求 Win7 安装 **WMF 5.1（PowerShell 5.1）** 和 .NET 4.x。
- **MySQL**：优先 ODBC；未安装 ODBC 时回退内置 `mysql2`，不依赖 PowerShell。
- **打印机队列**：Win7 用 `rundll32 printui.dll,PrintUIEntry` + `prnge001.inf` 创建 Generic / Text Only 队列；中文系统驱动名需要真机验证。
- **GDI/RAW 打印**：依赖 PowerShell `Add-Type` 编译 C#（需要 .NET 4.x），并使用 32 位打印机驱动。

## 尚未验证 / 注意事项

- **未在真实 Windows 7 SP1 32 位机器上运行**；Win7 需要 SP1 + SHA-2 更新，且必须使用 32 位打印机驱动。
- 安装包当前测试构建**未签名**；正式发布要配置证书，Win7 需能验证 SHA-256 签名。
- `electron-updater` 的线上 `/updates/win7/latest.yml` 尚未部署；legacy 版不能收到主线 x64 包。
- 许可服务/设备绑定尚未加 `platform=win7-ia32` 字段，目前沿用同一账号；上线前需确认。
- Electron 22 已 EOL，无 Chromium 安全更新，仅建议内网/受控环境。
- 32 位进程内存上限约 4GB，大模板/大图片需关注。

# Research: 桌面端在线更新链路

**Feature**: `018-online-update` | **Date**: 2026-10-27

## R1 — 更新引擎：electron-updater

**Decision**: 使用 `electron-updater` 6.8.x，配合现有 `electron-builder` 26.17 的 generic provider。

**Rationale**:
- 现有 `electron-builder` 已经产出 NSIS、dmg/zip、AppImage/deb 与 `.blockmap`；`electron-updater` 直接消费这些产物。
- 内置下载、SHA-512 校验、进度事件、取消、`quitAndInstall`，三端行为一致。
- 支持 Windows NSIS、macOS zip（dmg 仅作手动安装）、Linux AppImage；无需为三端各写替换逻辑。
- 已在 Electron 生态长期使用，能与现有主进程/preload/沙箱边界配合。

**Alternatives considered**:
- **Electron 内置 `autoUpdater`**：Windows 走 Squirrel、macOS 支持有限、Linux 不支持；不能覆盖三端。
- **手写下载/安装器**：需要分别处理 NSIS 静默安装、macOS 签名/公证与替换、Linux AppImage 替换；测试与安全成本远高于引入成熟库。
- **继续用 `/api/version` + 浏览器下载**：只能完成“打开下载链接”，无法应用内下载/安装/重启，不满足本特性。

## R2 — 更新源：generic feed

**Decision**: 更新源固定为 `https://new.yuwangchenfa.com/updates/`，使用 `electron-builder` 的 generic provider 生成并托管：

- `latest.yml`（Windows NSIS）
- `latest-mac.yml`（macOS zip）
- `latest-linux.yml`（Linux AppImage）
- 对应安装包、`.blockmap` 与 `app-update.yml`（打包进应用资源）

**Rationale**:
- 与现有发布域名一致，不新增服务；静态文件可由 nginx 直接提供。
- `app-update.yml` 由 `electron-builder` 在打包时写入 `resources`，打包应用无需运行时拼 URL。
- 开发/自动化测试可以用 `MAXLABEL_UPDATE_URL`（仅非打包构建）指向本地静态 feed；打包构建忽略该覆盖。

**Alternatives considered**:
- 复用 `/api/version` JSON：旧服务端从未实现该路由；且 electron-updater 需要 YAML 元数据（sha512、path、files）。
- 自建更新 API：增加服务端与鉴权面，收益低。
- 第三方更新服务：引入外部依赖与账号，不符合当前固定域名/自托管模式。

**Legacy**: 旧版（≤1.0.22）只认识 `/api/version`。发布时额外生成一个静态 JSON（`version`/`url`/`notes`）供旧版手动下载新安装包；首版 1.0.23 因此需要老用户手动安装一次，后续才进入自动更新。

## R3 — “不提示更新”设置：AppOptions.localStorage

**Decision**: 在现有 `AppOptions` 增加 `updateCheckOnStartup: boolean`，默认 `true`；`OptionsDialog` 增加「不提示更新」勾选项（勾选 = 不启动检查，即 `updateCheckOnStartup=false`）。启动检查由渲染层 `useUpdateStartup` 读取该设置决定是否发起；手动检查不读该设置。

**Rationale**:
- 启动检查本来就是渲染层在起始页挂载后发起的；主进程不需要在启动时读取设置。
- 与语言、单位、启动向导等设置同源，复用 `loadOptions/saveOptions` 与现有设置 UI。
- 设置随 localStorage 持久化，跨重启与更新保留；无需新增 `app-config.json` 字段与 IPC 契约。

**Alternatives considered**:
- 放 `app-config.json`：主进程并不主动发起启动检查，增加字段与契约但无收益；还多一处迁移面。
- 每次启动询问：违反“可设置为不提示更新”的安静启动要求。

## R4 — 更新编排：主进程状态机 + 渲染层 UI

**Decision**: 主进程新增 `updateService`（封装 `autoUpdater`）与 `registerUpdateIpc`；渲染层只负责设置、提示、进度和安装前确认。

主进程配置：
- `autoDownload = false`（用户确认后才下载）
- `autoInstallOnAppQuit = false`（由用户确认/未保存守卫后安装）
- `allowDowngrade = false`
- `allowPrerelease = false`
- 下载/更新使用 electron-updater 的 `CancellationToken`
- 进度事件节流（约 250ms）后转发给渲染层

渲染层流程：
- 启动检查：`updateCheckOnStartup` 为 true 时调用 `update:check`；仅 `update` 状态弹提示，失败静默。
- 手动检查：始终调用 `update:check`，并打开对话框显示 checking/latest/update/error。
- 更新可用：对话框提供「立即更新」「稍后」；「立即更新」调用 `update:download`。
- 下载中：显示进度、可取消；取消/失败回到可用状态。
- 下载完成：主进程状态变为 `ready`；渲染层执行 `hasRunningOperation` 检查 + `closeAll` 未保存确认；通过后调用 `update:install`。
- 打印/预览/导出中或用户取消保存：保持 `ready`，界面提供「立即重启」；绝不强制关闭。

**Alternatives considered**:
- 主进程直接弹 Electron 原生对话框：无法复用现有未保存确认与 i18n/UI。
- 渲染层直接使用 `electron-updater`：破坏沙箱/安全边界，且需要把 Node 能力暴露给 renderer。

## R5 — 完整性、来源与签名

**Decision**:
- 更新包完整性以 `latest*.yml` 的 `sha512` 为准，`electron-updater` 下载后校验；校验失败不执行。
- 更新源固定、仅 HTTPS；打包构建忽略 `MAXLABEL_UPDATE_URL` 等运行时覆盖。
- Windows 发布包必须代码签名；`electron-updater` 的发布者校验与安装器签名配合。
- macOS 发布包必须签名并公证；否则自动更新不可靠。
- Linux 发布 AppImage；以 SHA-512 校验为主。

**Rationale**: 自动安装会执行下载的可执行文件；没有完整性/来源校验等于把更新源变成远程代码执行入口。符合 FR-009/FR-018 与宪法原则 III 的安全底线。

**Alternatives considered**:
- 只校验 HTTPS：不能防篡改/镜像替换。
- 只校验版本号：不能证明包内容。
- 不做签名：SmartScreen/macOS 公证会拦截，且不满足发布可信性。

## R6 — 打包：electron-updater 的依赖处理

**Decision**: 优先把 `electron-updater` 作为主进程依赖**外部化**，并在 `app/package.json` 的 `build.files` 中加入 `electron-updater` 及其运行时依赖闭包；用打包冒烟验证。若外部化闭包维护成本过高，改用 `externalizeDepsPlugin({ exclude: ['electron-updater'] })` 将其打进主进程 bundle（备选）。

**Rationale**:
- 项目当前 `build.files` 是显式白名单；`electron-vite` 又使用 `externalizeDepsPlugin` 外部化依赖。直接加 `electron-updater` 不会自动带入其依赖（`builder-util-runtime`、`fs-extra`、`js-yaml`、`semver`、`lazy-val` 等），运行时会 `Cannot find module`。
- 外部化 + 显式依赖闭包与现有 `serialport`/`usb`/`iconv-lite` 的处理方式一致，运行时行为最可预测。
- 若闭包过大/易漏，bundle 方案可减少打包文件；以打包冒烟（启动应用 + 触发一次 mock/本地 feed 检查）作为切换判据。

**Alternatives considered**:
- 只加 `node_modules/electron-updater/**/*`：漏掉传递依赖，运行时必炸。
- 把 `node_modules/**/*` 全打进包：体积膨胀，且 renderer 依赖已被 vite 打包，重复。
- 运行 `npm install` 到应用目录：用户机器不可控，不可行。

## R7 — 发布流水线与 feed 上传

**Decision**:
- `package.json` 增加 `build.publish`（generic，URL 固定为 `https://new.yuwangchenfa.com/updates/`）。
- 构建脚本显式 `--publish never`，只产生产物；新增 `publish-update.cjs` 校验 `latest*.yml`、安装包、blockmap 与 SHA-512，并上传到更新目录。
- 更新目录由现有 nginx 静态提供；不新增后端接口。
- 同时生成老客户端 `/api/version` 兼容 JSON（指向新安装包），用于 1.0.22 及更早版本的一次性迁移。
- 发布顺序：先上传安装包/元数据 → 验证 feed 可访问与校验和 → 再更新 `/api/version`（老客户端入口）。

**Rationale**: 与现有固定域名、nginx 静态站点、`electron-builder` 产物一致；不引入新服务/账号。

**Alternatives considered**:
- GitHub Releases：与现有域名/发布流程不一致，且需要额外网络可达性。
- 自建上传 API：增加鉴权与运维面，收益低。

## R8 — 三端产物与安装差异

**Decision**:
- Windows：NSIS（现有 `win.target`），`oneClick=false` 保持不变；`quitAndInstall` 使用 NSIS 安装器。
- macOS：保留 dmg（手动安装）+ zip（自动更新）；发布必须签名/公证。
- Linux：保留 AppImage（自动更新）+ deb（手动安装）；AppImage 需要可执行权限与可写路径。
- 三端共用同一主进程状态机与渲染 UI；平台差异只在 `updateConfig`/打包脚本中。

**Rationale**: 与 `package.json` 现有 targets 对齐；electron-updater 对这三类产物有官方支持。

**Alternatives considered**:
- 只做 Windows：已被澄清为三端全覆盖。
- 只做 AppImage/NSIS：macOS 用户无法自动更新。

## R9 — 测试策略

**Decision**:
- Unit：`updateService` 状态机、错误映射、进度节流、取消、安装前置条件；`AppOptions` 新字段归一化；`useUpdateStartup` 启用/跳过。
- Contracts：`update:*` 通道唯一性、preload 白名单、sender 校验、DTO 形态。
- Integration：mock `electron-updater` 的事件序列（check → available → download → progress → ready → install；取消/错误分支）。
- E2E：通过非打包测试适配器 `app/src/main/update/updateTestAdapter.ts`（`MAXLABEL_TEST_UPDATE`）模拟 available/progress/ready/error/install-request；验证启动提示、设置关闭、手动检查、进度、取消、未保存确认、安装请求（不真正退出）。
- 人工：三端真实安装包、真实 feed、签名/公证、提权、杀软；明确列为不自动化项。

**Rationale**: 真实安装器执行无法在 CI 安全/稳定地自动化；但状态机、IPC 与 UI 可以完全自动化。符合宪法原则 I 与「显式声明不验证项」。

**Alternatives considered**:
- 只做单元测试：无法覆盖渲染层与安装握手。
- CI 里真实安装/重启：会改动测试机、依赖三端 runner 与签名，成本与风险高。

## R10 — 迁移与旧代码处置

**Decision**:
- 新客户端删除 `app/src/main/updater.ts` 的自定义 `/api/version` 检查与对应测试；`registerServiceIpc` 的 `update:check` 迁移到 `registerUpdateIpc`。
- `UpdateCheckResultDto` 替换为新的 `UpdateCheckResultDto`/`UpdateStateDto`；`url` 字段不再用于“打开浏览器下载”。
- 旧版 1.0.22 的迁移由发布侧 `/api/version` 静态 JSON 承担；首版 1.0.23 手动安装一次。
- `MAXLABEL_UPDATE_URL` 仅保留为非打包构建/自动化测试的 feed 覆盖；打包构建忽略。

**Rationale**: 旧检查只判断版本，无法完成下载/安装/重启；保留两套检查会产生两套真相。旧客户端的迁移是发布动作，不需要在新客户端保留死代码。

**Alternatives considered**:
- 同时保留旧 JSON 检查与 electron-updater：双真相、双错误路径。
- 让旧版自动升级：旧版没有 electron-updater，做不到；必须手动安装一次。

## R11 — 安装前未保存守卫

**Decision**:
- `ready` 后由渲染层调用现有 `closeAll()`（含保存/放弃/取消）；同时检查 `hasRunningOperation()`。
- 通过后调用 `update:install`；主进程设置 `allowMainWindowClose=true` 并调用 `quitAndInstall`。
- 打印/预览/导出中或用户取消保存：不安装，保持 `ready`；对话框提供「立即重启」。
- `update:install` 主进程再次校验状态与未安装标记，防止重复调用。

**Rationale**: `quitAndInstall` 会退出应用；必须复用现有未保存确认，不能第二次实现一套关闭守卫。将“是否可安装”放在渲染层，主进程只执行已确认的安装。

**Alternatives considered**:
- 主进程直接 `quitAndInstall`：绕过未保存确认，可能丢失标签页。
- 用 Electron 原生 `before-quit` 弹确认：与现有保存/放弃/取消流程不一致，且无法在 renderer 之外安全保存文档。

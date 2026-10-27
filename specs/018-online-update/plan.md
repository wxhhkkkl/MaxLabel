# Implementation Plan: 桌面端在线更新链路

**Branch**: `018-online-update` | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/018-online-update/spec.md`

## Summary

把现有的「只检查版本、在浏览器里打开下载链接」升级为完整的三端在线更新链路：

- 启动时按用户设置检查更新（可关闭启动检查与提示，手动检查始终保留）
- 发现新版本后由用户确认，应用内下载并显示进度
- 下载完成后校验更新包，自动安装并重新打开软件
- 支持取消、稍后、断网/校验失败/安装失败的安全恢复
- 覆盖 Windows（NSIS）、macOS（zip/dmg）、Linux（AppImage）

技术路线：复用现有 `electron-builder` 打包体系，引入 `electron-updater` 及其 generic provider；主进程独占更新器与安装动作，渲染层只负责设置、提示与进度 UI。旧的 `/api/version` 自定义检查仅保留为老版本客户端的一次性迁移入口，新客户端改用 `electron-updater` 的 `latest*.yml` 更新源。

## Technical Context

**Language/Version**: TypeScript 5.5、Node 22、Electron 44.3、React 18.3

**Primary Dependencies**: 现有 `electron-vite` 5、`electron-builder` 26.17、Vitest 5、Playwright；新增 `electron-updater` 6.8.x（运行时依赖）。不引入 UI 组件库。

**Storage**: 更新设置存在现有 `AppOptions`（localStorage）中，字段 `updateCheckOnStartup`（默认 `true`）；下载缓存由 `electron-updater` 管理（用户数据目录下的更新缓存）。不改数据库，不改模板/文档持久化格式。

**Testing**: Vitest（unit / contracts / integration）+ Playwright（Electron e2e）+ 三端真实安装包人工验证。按宪法原则 I，先写失败测试。

**Target Platform**: Windows 10/11（NSIS）、macOS（zip/dmg）、Linux（AppImage）

**Project Type**: Electron 桌面应用（main / preload / renderer / shared）

**Performance Goals**:
- 启动检查不阻塞起始页；正常网络下有更新时 10 秒内出现提示（SC-001）
- 下载开始后 2 秒内可见进度；10 Mbps、常规安装包（≤ 200 MB）下确认到重启 ≤ 5 分钟（SC-004）
- 下载/校验阶段 UI 保持可操作，0 次卡死（SC-010）

**Constraints**:
- 更新源固定为受信任的发布地址；不在运行时接受用户输入的任意 URL
- 安装包必须校验完整性与来源；Windows 代码签名、macOS 签名/公证是发布前置条件
- 用户确认后下载；不强制更新；不自动回滚；不清理用户数据
- 三端安装差异收敛在主进程更新服务，渲染层不执行安装器
- `updateService` 记录检查/下载/校验/安装失败摘要到现有应用日志，不记录凭据或完整查询参数（FR-020）
- 首版自动更新客户端（1.0.23）需老用户手动安装一次，之后才能自动更新

**Scale/Scope**: 单桌面应用、三端；约 15–20 个源文件/测试文件 + 发布脚本；预计新增 1 个运行时依赖。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 结论 | 说明 |
|------|------|------|
| I. 测试先行（TDD，不可协商） | PASS | 计划按「设置/启动检查 → 更新服务状态机 → 下载/取消 → 安装/未保存守卫 → IPC 契约」逐层先写失败测试；e2e 使用 mock 更新适配器，真实安装器人工验证 |
| II. 先澄清，不猜测 | PASS | 规格已完成 5 个澄清（不提示更新语义、下载时机、三端范围、无自动回滚、编辑中提示）；剩余未决项仅是实现机制，见 Complexity Tracking |
| III. 巨大架构变更先确认 | **PASS** | 新增 `electron-updater`、generic feed、签名/公证与发布流水线属于巨大架构变更。方案、替代方案、代价与回滚已写入本计划；**所有者已于 2026-10-27 确认 Owner Sign-off 的 5 项**，可以进入实现 |
| 技术栈约束（Electron/React/Fabric、单一数据库） | PASS | 不替换技术栈、不新增数据库；更新器是桌面端运行时依赖，仅主进程使用 |
| 最小改动 / 既有分层 | PASS | 复用现有 `OptionsDialog`、`UpdateDialog`、`MenuBar`、`AppOptions` 与 IPC 守卫；仅替换旧的浏览器下载逻辑；删除被替换的 `updater.ts` 及其测试属于本次变更范围 |
| 增量可验证 | PASS | 每个阶段有独立验收：检查/设置、下载/取消、安装/重启守卫、三端打包/发布 |

**Gate 说明**：III 已由所有者于 2026-10-27 确认（见文末「Owner Sign-off」），当前为 **PASS**；实现可直接按本计划进入 `/speckit-implement`，无需再次等待确认。

## Project Structure

### Documentation (this feature)

```text
specs/018-online-update/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── update-ipc.md
│   └── update-feed.md
└── tasks.md              # /speckit-tasks 生成，本命令不创建
```

### Source Code (repository root)

```text
app/
├── package.json                         # + electron-updater、publish(generic)、签名/打包说明
├── electron.vite.config.ts              # 主进程依赖处理（externalize + 依赖闭包；bundle 为备选）
├── build/                               # 现有图标资源
├── scripts/
│   ├── build-windows.cjs                # 现有；补 --publish never / 产物体检
│   ├── build-macos.cjs                  # 新增：macOS zip/dmg 构建
│   ├── build-linux.cjs                  # 新增：AppImage/deb 构建
│   └── publish-update.cjs               # 新增：校验 latest*.yml/产物并上传更新源
├── src/
│   ├── main/
│   │   ├── index.ts                     # 初始化更新服务、注册 IPC、安装前允许关闭
│   │   ├── update/
│   │   │   ├── updateService.ts         # 更新状态机 + electron-updater 封装
│   │   │   ├── updateConfig.ts          # feed 地址/平台/开发测试覆盖
│   │   │   └── updateTestAdapter.ts     # 非打包 MAXLABEL_TEST_UPDATE 适配器（e2e 用）
│   │   ├── ipc/
│   │   │   └── registerUpdateIpc.ts     # update:* 通道
│   │   └── updater.ts                   # 被 updateService 取代（删除）
│   ├── preload/index.ts                 # + window.maxlabel.update 命名空间
│   ├── shared/
│   │   ├── ipcContract.ts               # 新 IPC 类型与通道；AppOptions 字段
│   │   └── i18n/messages.*.ts           # 更新设置/下载/安装/失败文案
│   └── renderer/src/
│       ├── App.tsx                      # 手动检查、启动检查、ready→closeAll→install
│       ├── features/shell/
│       │   ├── useUpdateStartup.ts      # 按 updateCheckOnStartup 决定是否启动检查
│       │   └── useUpdateState.ts        # 订阅 update:changed / 状态查询
│       ├── dialogs/
│       │   ├── MoreDialogs.tsx          # UpdateDialog 重做（进度/取消/重启）
│       │   └── OptionsDialog.tsx        # “不提示更新”设置
│       └── styles.css                   # 更新对话框/进度条样式
└── tests/
    ├── unit/main/update-service.test.ts
    ├── unit/renderer/update-startup.test.ts
    ├── unit/renderer/app-options.test.ts
    ├── contracts/update-ipc.test.ts
    ├── integration/main/update-service.test.ts
    └── e2e/update-flow.spec.ts
```

**Structure Decision**: 单桌面应用单仓库；更新器只在 `main`，渲染层通过白名单 IPC 访问。`shared/ipcContract.ts` 是唯一契约来源；`renderer` 不直接调用 `electron-updater`，也不执行安装器。

## Complexity Tracking

| 决策/代价 | 为什么需要 | 更简单的替代方案为何不可行 |
|-----------|------------|------------------------------|
| 新增 `electron-updater` 运行时依赖 | 三端统一的下载、校验、安装、重启；复用 `electron-builder` 已生成的 NSIS/dmg/zip/AppImage 与 blockmap | 手写下载器：Windows 静默安装、macOS 签名/公证/替换、Linux AppImage 替换都要自己实现，风险与测试成本更高 |
| 引入 generic feed（`latest*.yml` + 安装包 + blockmap） | `electron-updater` 的标准更新协议；与现有 `electron-builder` 发布产物同源 | 继续用 `/api/version` JSON：只能“打开下载链接”，无法完成应用内下载/安装/重启；且旧服务端从未实现该路由 |
| 代码签名 / macOS 公证 / 发布流水线 | 自动安装必须能验证来源；macOS 未签名应用无法可靠自动更新 | 不签名直接安装：被 SmartScreen/公证拦截，且 electron-updater 的来源校验不完整，违反 FR-009/018 |
| 主进程新增更新状态机与 IPC | 安装器执行是特权操作；渲染层不能直接下载/执行安装包 | 在渲染层调用 `electron-updater`：破坏现有安全边界，且 renderer 沙箱不接触 Node |
| 首版需要一次手动安装 | 1.0.22 及更早版本没有 `electron-updater`，无法被新 feed 自动升级 | 让旧版直接跳到新 feed：旧版只支持 `/api/version` JSON，需旧版发版才能改，成本更高 |
| 更新设置放在 `AppOptions`（localStorage） | 启动检查由渲染层发起；设置与语言/常规选项同源，避免新增主进程配置文件字段 | 放 `app-config.json`：主进程并不发起启动检查，增加契约与迁移面而无收益 |

**回滚方式**：
- 关闭启动检查/提示（设置项）或发布关闭开关，退回手动检查/手动安装
- `autoUpdater.autoDownload=false`、`autoInstallOnAppQuit=false`：不确认不下载、不自动安装
- 保留上一版本安装包与 feed 历史；安装失败/新版本无法启动时按 `quickstart.md` 手动重装上一版本
- 若 `electron-updater` 外部化 + 依赖闭包的打包/运行验证失败，可退回「bundle 进主进程」方案（见 research R6），不影响产品行为

## Phased Delivery

### Phase A — 检查与设置（可独立验收）

1. 在 `AppOptions` 增加 `updateCheckOnStartup`（默认 `true`），`OptionsDialog` 增加「不提示更新」勾选项（勾选 = 不启动检查）。
2. 用 `updateService` 替换旧 `updater.ts` 的检查：`update:check` 返回最新/可更新/不可用；启动检查按设置跳过。
3. 手动检查入口始终可用；错误在手动检查时显性显示。
4. 测试先行：设置归一化、`useUpdateStartup` 跳过/发起、`updateService.check` 的 latest/available/unavailable。

### Phase B — 下载、进度与取消

1. `update:download` 调用 `autoUpdater.downloadUpdate`，`update:changed` 推送进度（节流）。
2. `update:cancel` 取消下载；失败/取消回到可用状态。
3. `UpdateDialog` 显示进度、取消、错误重试。
4. 测试先行：状态机、进度映射、取消、错误映射；e2e 用 mock 适配器验证进度/取消。

### Phase C — 安装、重启与未保存守卫

1. 下载完成进入 `ready`；渲染层收到后自动准备安装：`hasRunningOperation` 检查 + `closeAll` 未保存确认。
2. 只有确认通过才调用 `update:install`；主进程设置允许关闭并 `quitAndInstall`。
3. 取消/打印中/预览中 → 保持 `ready`，界面提供「立即重启」；不丢失内容。
4. 测试先行：安装前置条件、closeAll 取消、打印中阻止、install 只调用一次；e2e 用 mock install 断言不真正退出。

### Phase D — 打包、更新源与发布

1. `package.json` 增加 `electron-updater`、generic `publish`、三端产物与签名说明。
2. 主进程依赖处理（bundle 或 externalize）与打包体检；生成 `latest.yml`/`latest-mac.yml`/`latest-linux.yml`/`app-update.yml`。
3. `publish-update.cjs` 校验产物与 SHA-512 并上传到 `https://new.yuwangchenfa.com/updates/`；生成老客户端 `/api/version` 迁移 JSON。
4. 打包冒烟：打包后的应用能启动、能读到 feed、能完成一次 mock/本地 feed 检查。

### Phase E — 三端人工验收

按 `quickstart.md` 在 Windows/macOS/Linux 各完成一次真实安装 → 检查 → 下载 → 安装 → 重启；记录签名/公证/提权/杀软结果。明确不自动化的项在 quickstart 中列出。

## Post-Design Constitution Re-check

| 原则 | 结论 | 设计后说明 |
|------|------|------------|
| I. TDD | PASS | 每个 Phase 都先写失败测试；e2e 与人工验证边界明确 |
| II. 澄清 | PASS | 5 个澄清已写入 spec；实现机制在 research R1–R11 中决策 |
| III. 巨大架构变更 | **PASS** | 方案、替代、代价、回滚已写入 Complexity Tracking；所有者 2026-10-27 已确认，可进入实现 |
| 技术栈/分层 | PASS | 更新器只在 main；renderer 走白名单 IPC；无新数据库/框架 |
| 最小改动 | PASS | 复用现有设置/对话框/菜单/AppOptions；删除仅限被替换的旧 updater |

## Owner Sign-off

**Status**: CONFIRMED — 2026-10-27

所有者已确认以下架构决策（实现按此执行；如需调整，先更新本计划）：

1. [x] **更新引擎**：采用 `electron-updater` + `electron-builder` generic provider，而不是手写下载器或 Electron 内置 `autoUpdater`。
2. [x] **更新源**：固定为 `https://new.yuwangchenfa.com/updates/`；运行时不允许用户改 feed URL。
3. [x] **发布与签名**：Windows 代码签名、macOS 签名/公证、Linux AppImage 作为发布前置条件；首版 1.0.23 由老用户手动安装一次。
4. [x] **安装策略**：用户确认后下载；下载完成自动准备安装/重启，但有未保存内容或打印/预览/导出时先确认或延后；不自动回滚。
5. [x] **设置存储**：`updateCheckOnStartup` 存入现有 `AppOptions`（localStorage），设置项文案为「不提示更新」。

## Implementation Results (2026-10-27)

**已完成**

- `electron-updater` 6.8.11 接入；主进程 `updateService` 状态机、feed 配置、测试适配器、IPC/preload、渲染层设置/对话框/未保存守卫全部实现。
- 自动化：`npm test` 125 文件 / 769 条通过；`tests/e2e/update-flow.spec.ts` 6 条通过。
- 打包：Windows 目录包与 NSIS 均成功生成；`app-update.yml`/`latest.yml` 已生成；打包后的 `MaxLabel.exe` 能在隔离 `APPDATA` 下启动并显示起始页。
- 发布脚本：`publish-update.cjs` 的 SHA-512/大小/相对 URL 校验通过，产物与旧版 `version.json` 已暂存到 `release/updates-staging`。

**未执行（需签名证书、staging feed 与三端机器）**

- T050/T051/T052 三端真实安装/更新/重启；T053 的实测记录仅记录了自动化结果，真实数据保留比对待补。
- Windows 代码签名、macOS 签名/公证、Linux AppImage 提权/可写路径、杀软拦截。
- 这些项目在 `quickstart.md` §7 已明确列为人工验证，未用自动化结果冒充。

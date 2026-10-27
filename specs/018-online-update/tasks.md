# Tasks: 桌面端在线更新链路

**Input**: Design documents from `specs/018-online-update/`

**Prerequisites**: plan.md（必需）、spec.md（必需，含 5 条澄清）、research.md、data-model.md、contracts/、quickstart.md

**Tests**: 本项目宪法原则 I 要求 TDD，**测试不是可选项**。每个用户故事的测试任务列在实现任务之前；必须先让测试失败，再写实现。

**Organization**: 任务按用户故事分组，每个故事可独立实现、独立测试、独立交付。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可在不同文件并行（无未完成依赖）
- **[Story]**: 所属用户故事（US1–US4）
- 每个任务都包含明确文件路径；路径相对仓库根 `app/`

## Path Conventions

- 桌面端单仓库：`app/src/main`、`app/src/preload`、`app/src/renderer/src`、`app/src/shared`
- 测试：`app/tests/unit`、`app/tests/contracts`、`app/tests/integration`、`app/tests/e2e`
- 构建/发布：`app/package.json`、`app/electron.vite.config.ts`、`app/scripts/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 引入更新器依赖、共享契约与文案，为所有故事提供编译基础。

- [X] T001 在 `app/package.json` 的 `dependencies` 增加 `electron-updater`（6.8.x），更新 lockfile；确认主进程可 `import { autoUpdater } from 'electron-updater'`
- [X] T002 [P] 在 `app/src/shared/ipcContract.ts` 增加 `update:*` IPC 通道、`UpdateCheckResultDto`、`UpdateStateDto`、`UpdateProgressDto`、`window.maxlabel.update` 类型（见 `contracts/update-ipc.md`）
- [X] T003 [P] 在 `app/src/shared/i18n/messages.zh-CN.ts` 与 `messages.en-US.ts` 增加更新设置、检查中、发现新版本、已是最新、下载中、取消、安装、重启、失败/校验失败/忙等文案键

**Checkpoint**: 依赖、类型和文案可编译。

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 更新状态机、feed 配置、IPC 骨架、渲染层状态订阅与打包依赖处理；所有故事依赖本阶段。

**⚠️ CRITICAL**: 本阶段完成前不开始 US1–US4。

### Tests (fail first)

- [X] T004 [P] 先写失败测试：`app/tests/unit/main/update-config.test.ts` 覆盖 feed URL 固定、平台映射、非打包 `MAXLABEL_UPDATE_URL` 覆盖、打包忽略覆盖
- [X] T005 [P] 先写失败测试：`app/tests/contracts/update-ipc.test.ts` 覆盖通道唯一性、preload 白名单、sender 校验、DTO 字段
- [X] T006 [P] 先写失败测试：`app/tests/unit/main/update-service.test.ts` 覆盖状态机骨架（idle/checking/available/latest/downloading/ready/installing/error）、状态查询、事件发送、错误键映射
- [X] T007 [P] 先写失败测试：`app/tests/unit/renderer/update-state.test.ts` 覆盖 `useUpdateState` 订阅 `update:changed`、挂载时拉取 `update:state`、卸载取消订阅

### Implementation

- [X] T008 [P] 实现 `app/src/main/update/updateConfig.ts`：固定 feed/平台/arch、非打包测试覆盖、打包构建拒绝运行时覆盖
- [X] T009 实现 `app/src/main/update/updateService.ts` 的状态存储、事件发送、进度节流与错误映射骨架（check/download/install 的具体行为留给 US1/US2）；同时实现 `app/src/main/update/updateTestAdapter.ts`：仅在非打包构建按 `MAXLABEL_TEST_UPDATE` 启用，模拟 available/progress/ready/error/install-request，T016/T026/T034/T041 依赖它
- [X] T010 实现 `app/src/main/ipc/registerUpdateIpc.ts` 并接入 `app/src/main/index.ts`：注册 `update:check/download/cancel/install/state`，通过 `secureIpcHandler` 限定主窗口；提供 `allowMainWindowClose` 回调
- [X] T011 在 `app/src/preload/index.ts` 暴露 `window.maxlabel.update.*` 与 `onChanged`，只转发白名单通道，不接受 URL/路径参数
- [X] T012 实现 `app/src/renderer/src/features/shell/useUpdateState.ts`：订阅 `update:changed`、初始拉取 `update:state`、卸载清理
- [X] T013 [P] 校验 `electron-updater` 打包策略：在 `app/electron.vite.config.ts`/`app/package.json` 选择 externalize + 依赖闭包（主）或 bundle（备选），用 `app/release/win-unpacked` 做启动冒烟；记录结果到 `specs/018-online-update/research.md` R6

**Checkpoint**: 状态机/IPC/打包基础可用；可开始各用户故事。

---

## Phase 3: User Story 1 - 启动自动检查与手动检查 (Priority: P1) 🎯 MVP

**Goal**: 启动时按条件检查更新并提示；手动检查始终可用并如实显示最新/可更新/失败；只提示严格更新的稳定版本。

**Independent Test**: 用 `MAXLABEL_TEST_UPDATE=available|latest|error` 启动，验证提示/静默/手动检查；再用真实 feed 的打包构建验证一次。

### Tests for User Story 1（先写并确认失败）

- [X] T014 [P] [US1] 在 `app/tests/unit/main/update-service.test.ts` 增加 `check()` 用例：`latest > current` → available；相等/更低 → latest；非法 feed/网络 → unavailable；预发布忽略；错误键正确
- [X] T015 [P] [US1] 在 `app/tests/unit/renderer/update-startup.test.ts` 增加 `useUpdateStartup` 用例：启用时发起检查；有更新才回调；失败静默；不重复发起
- [X] T016 [P] [US1] 在 `app/tests/e2e/update-flow.spec.ts` 增加启动提示与手动检查用例：available/latest/error、起始页先可用、无重复弹窗；断言起始页可用后 ≤10 秒出现提示并记录耗时（SC-001）；依赖 T009 的 `MAXLABEL_TEST_UPDATE` 适配器

### Implementation for User Story 1

- [X] T017 [US1] 在 `app/src/main/update/updateService.ts` 实现 `check()`：配置 `autoUpdater.autoDownload=false`、`autoInstallOnAppQuit=false`、`allowDowngrade=false`、`allowPrerelease=false`；映射 `checkForUpdates()` 结果到 `UpdateCheckResultDto`
- [X] T018 [US1] 在 `app/src/main/update/updateService.ts` 记录检查失败摘要（网络/feed/版本），不记录凭据/完整查询参数（FR-020）
- [X] T019 [US1] 在 `app/src/renderer/src/features/shell/useUpdateStartup.ts` 改为接受启用标志并调用 `window.maxlabel.update.check()`；失败静默、仅 `update` 回调；在 `app/src/renderer/src/App.tsx` 接入
- [X] T020 [US1] 在 `app/src/renderer/src/App.tsx` 改造 `handleCheckUpdate`：不读 localStorage serverUrl，始终调用 `update.check()`；打开对话框并显示 checking/latest/update/unavailable；手动检查 ≤10 秒返回明确结果（SC-007）
- [X] T021 [US1] 在 `app/src/renderer/src/dialogs/MoreDialogs.tsx` 改造 `UpdateDialog` 的检查态：当前/最新/发布说明/已是最新/检查失败；available 态提供「立即更新」「稍后」两个入口（具体下载/稍后行为在 US2 接线）；移除“打开浏览器下载”旧行为
- [X] T022 [US1] 删除被替换的 `app/src/main/updater.ts` 与 `app/tests/unit/main/updater.test.ts`；从 `app/src/main/ipc/registerServiceIpc.ts` 移除旧 `update:check`，更新引用与测试
- [X] T023 [US1] 更新 `app/src/shared/i18n/messages.*.ts` 中的 US1 检查/提示文案（`app/tests/INDEX.md` 映射归入 T053 的收尾）

**Checkpoint**: 启动检查、手动检查、提示与失败静默可独立验收；US1 完成。

---

## Phase 4: User Story 2 - 下载、安装并重新打开软件 (Priority: P1)

**Goal**: 用户确认后下载并显示进度；可取消；下载完成校验后自动准备安装/重启；有未保存内容或打印/预览/导出时先确认或延后。

**Independent Test**: 用 mock 适配器走 available → 下载进度 → cancel/ready → closeAll 取消/打印中阻止 → install 请求；再用打包产物 + staging feed 真实安装一次。

### Tests for User Story 2（先写并确认失败）

- [X] T024 [P] [US2] 在 `app/tests/unit/main/update-service.test.ts` 增加下载/取消/进度/ready 用例：仅 available 可下载；进度 0–100、节流；取消回 available；下载失败不 ready；重复下载幂等
- [X] T025 [P] [US2] 在 `app/tests/integration/main/update-service.test.ts` 增加安装握手用例：仅 ready 可 install；closeAll 取消不 install；打印/预览/导出中不 install；install 只调用一次 `quitAndInstall`
- [X] T026 [P] [US2] 在 `app/tests/e2e/update-flow.spec.ts` 增加进度/取消/ready/install-requested 用例（依赖 T009 的 `MAXLABEL_TEST_UPDATE` 适配器，不真正退出）；断言下载开始后 ≤2 秒出现首个进度（SC-004）

### Implementation for User Story 2

- [X] T027 [US2] 在 `app/src/main/update/updateService.ts` 实现 `download()`/`cancel()`：`autoUpdater.downloadUpdate(token)`、`download-progress` 节流、`CancellationToken`、ready/error 状态
- [X] T028 [US2] 在 `app/src/main/ipc/registerUpdateIpc.ts` 实现 `update:download`/`update:cancel`/`update:install`；install 仅 ready 时接受，设置 `allowMainWindowClose` 并 `quitAndInstall`，失败恢复标志
- [X] T029 [US2] 在 `app/src/renderer/src/dialogs/MoreDialogs.tsx` 实现「立即更新」「稍后」、下载进度、取消、ready/「立即重启」、安装失败/忙提示；重启后界面/关于必须显示新版本号（FR-007/FR-010）
- [X] T030 [US2] 在 `app/src/renderer/src/App.tsx` 实现 ready 后自动准备安装：`hasRunningOperation()` + `closeAll()`；取消/忙碌保持 ready，不关闭；通过后调用 `update.install()`
- [X] T031 [US2] 补充 `app/src/shared/i18n/messages.*.ts` 的下载/取消/安装/重启/忙文案，并在 `app/src/renderer/src/styles.css` 增加进度条/对话框样式

**Checkpoint**: 下载、取消、安装握手与重启可独立验收；US2 完成。

---

## Phase 5: User Story 3 - “不提示更新”设置 (Priority: P2)

**Goal**: 设置持久化；勾选后启动不发起检查、不提示；手动检查不受影响。

**Independent Test**: 设置打开后连续启动不检查；手动检查仍能发现/更新；设置跨重启保留。

### Tests for User Story 3（先写并确认失败）

- [X] T032 [P] [US3] 在 `app/tests/unit/renderer/app-options.test.ts` 增加 `updateCheckOnStartup` 默认 `true`、缺失兼容、保存/归一化用例
- [X] T033 [P] [US3] 在 `app/tests/unit/renderer/update-startup.test.ts` 增加关闭时 **不调用** `update.check()`、手动检查仍调用用例
- [X] T034 [P] [US3] 在 `app/tests/e2e/update-flow.spec.ts` 增加设置打开后启动无检查/无提示、手动检查仍可用用例；连续 10 次启动均不发起检查/不提示（SC-002）；依赖 T009 的 `MAXLABEL_TEST_UPDATE` 适配器

### Implementation for User Story 3

- [X] T035 [US3] 在 `app/src/renderer/src/dialogs/OptionsDialog.tsx` 的 `AppOptions`/`DEFAULTS`/`normalizeAppOptions` 增加 `updateCheckOnStartup`（默认 `true`）；缺失字段按 true
- [X] T036 [US3] 在 `app/src/renderer/src/dialogs/OptionsDialog.tsx` 增加「不提示更新」勾选项：勾选 = `updateCheckOnStartup=false`；保存走现有 `saveOptions`
- [X] T037 [US3] 在 `app/src/renderer/src/App.tsx` 把 `options.updateCheckOnStartup` 传给 `useUpdateStartup`；手动检查保持无条件调用

**Checkpoint**: 设置独立验收；US3 完成。

---

## Phase 6: User Story 4 - 更新失败与安全恢复 (Priority: P2)

**Goal**: 网络/feed/下载/校验/安装失败时当前版本可用、用户数据不丢失；手动检查显性提示、启动静默；可重试；不执行未校验包。

**Independent Test**: 用 mock 适配器模拟 error/bad-checksum/404/busy/close-during-download；验证状态、提示、重试与当前版本可用。

### Tests for User Story 4（先写并确认失败）

- [X] T038 [P] [US4] 在 `app/tests/unit/main/update-service.test.ts` 增加错误映射用例：network/feed/download/verify/install/busy；校验失败不得 ready；错误键正确
- [X] T039 [US4] 在 `app/tests/unit/main/update-service.test.ts` 增加诊断用例：记录检查/下载/校验/安装摘要；不含凭据/完整查询参数（与 T038 同文件，串行）
- [X] T040 [P] [US4] 在 `app/tests/integration/main/update-service.test.ts` 增加关闭/取消下载、安装失败、重试用例：不进入半安装、当前版本仍可用
- [X] T041 [P] [US4] 在 `app/tests/e2e/update-flow.spec.ts` 增加 error/bad-checksum/404 的检查失败、下载失败、重试用例；依赖 T009 的 `MAXLABEL_TEST_UPDATE` 适配器

### Implementation for User Story 4

- [X] T042 [US4] 在 `app/src/main/update/updateService.ts` 实现 `error` 事件/状态与可重试路径；校验失败拒绝安装；`install` 失败恢复 `allowMainWindowClose`
- [X] T043 [US4] 在 `app/src/main/update/updateService.ts` 增加本地诊断日志（版本/状态/错误摘要），对凭据、完整 URL 查询参数脱敏
- [X] T044 [US4] 在 `app/src/main/update/updateService.ts` 处理应用退出/窗口关闭时取消检查/下载；未完成更新不得标记为已安装
- [X] T045 [US4] 在 `app/src/renderer/src/dialogs/MoreDialogs.tsx` 显示失败原因/重试/当前版本仍可用；启动检查失败保持静默

**Checkpoint**: 失败与恢复独立验收；US4 完成。

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 打包、更新源、发布脚本、三端人工验证、文档与全量回归。

- [X] T046 [P] 在 `app/package.json` 完成 `build.publish`（generic，`https://new.yuwangchenfa.com/updates/`）、`build.files` 依赖闭包/签名说明；确认 `app-update.yml` 由打包生成
- [X] T047 更新 `app/scripts/build-windows.cjs`，新增 `app/scripts/build-macos.cjs`/`app/scripts/build-linux.cjs`：`--publish never`、支持 `--publish.url`/环境覆盖 staging 与 production、生成 `latest*.yml`/blockmap、macOS zip/dmg、Linux AppImage/deb；依赖 T046 的 `build.publish` 配置（可并行编写，T046 后执行）
- [X] T048 新增 `app/scripts/publish-update.cjs`：接受 `--feed <url>`（staging/production，默认 production），校验 `latest*.yml` 的 `version`/`sha512`/`size`/相对 URL，上传产物与元数据；生成对应环境的旧版 `/api/version` 迁移 JSON。依赖 T047 生成的 `latest*.yml`；可先编写脚本，但必须在 T047 产物生成后执行
- [X] T049 打包冒烟（Windows）：从 `app/release/win-unpacked` 启动，确认 `app-update.yml` 可读、feed 可达（本地/staging），不崩溃；记录 `publish-update.cjs` 的 SHA-512/相对 URL 校验结果
- [ ] T050 [P] 按 `specs/018-online-update/quickstart.md` §4 在 Windows 使用 **staging feed** 完成一次真实安装 → 检查 → 下载 → 安装 → 重启，记录签名/提权/结果、确认到重启耗时（SC-004 ≤5 分钟），并在更新前后快照比对模板/设置/授权/本地文件（FR-016/SC-009）【未完成：需签名证书/staging feed/三端机器】
- [ ] T051 [P] 按 `specs/018-online-update/quickstart.md` §5 在 macOS 使用 **staging feed** 完成一次真实更新（签名/公证），记录结果、确认到重启耗时与更新前后数据保留比对【未完成：需签名证书/staging feed/三端机器】
- [ ] T052 [P] 按 `specs/018-online-update/quickstart.md` §5 在 Linux（AppImage）使用 **staging feed** 完成一次真实更新，记录结果、确认到重启耗时与更新前后数据保留比对【未完成：需签名证书/staging feed/三端机器】
- [ ] T053 更新 `app/tests/INDEX.md` 的更新映射、`specs/018-online-update/quickstart.md` 的实测记录与数据保留核对结果；补充未自动化项说明；依赖 T050-T052 的实测结果【自动化部分已完成：INDEX/quickstart 已更新；真实数据保留结果待补】
- [X] T054 在 `app/` 运行 `npm test`、`npm run build`、`npm run test:e2e`；修复回归；确认无 `[NEEDS CLARIFICATION]`/旧 updater 死代码
- [X] T055 更新 `specs/018-online-update/plan.md` 的实测结果与 Owner Sign-off 状态；确认发布顺序（feed 产物 → latest*.yml → 旧 /api/version）已写入文档

**Checkpoint**: 全量测试、打包与三端人工验证完成；可交付。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖；T001 必须先于 T008/T009/T013
- **Foundational (Phase 2)**: 依赖 Setup；**阻塞所有用户故事**
- **US1 (Phase 3)**: 依赖 Foundational；MVP 起点
- **US2 (Phase 4)**: 依赖 US1 的检查状态与 Foundational；可独立验收下载/安装
- **US3 (Phase 5)**: 依赖 Foundational；可与 US1/US2 并行（改 `AppOptions`/`OptionsDialog`，但 `App.tsx` 接线需与 US1 协调）
- **US4 (Phase 6)**: 依赖 US2 的下载/安装状态；可独立验收失败恢复
- **Polish (Phase 7)**: 依赖所需用户故事完成；T046 先完成 `build.publish`，T047 依赖 T046（可并行编写、后执行），T048 依赖 T047 的 `latest*.yml` 产物（可先编写、后执行），T049 依赖 T046/T047，T050–T052 依赖 T048/T049，T053 依赖 T050–T052，T054 依赖 T053，T055 依赖 T054

### User Story Dependencies

- **US1（P1，MVP）**：只依赖 Foundational；实现启动/手动检查与提示
- **US2（P1）**：依赖 US1 的 `check`/状态机；实现下载/安装/重启；不依赖 US3
- **US3（P2）**：独立于 US2；只改设置与 `useUpdateStartup` 的启用判断
- **US4（P2）**：依赖 US2 的状态；补齐失败映射/诊断/恢复

### Within Each User Story

- 测试先写并 FAIL，再实现
- 共享状态机/类型在 Foundational；故事内只加本故事能力
- 主进程实现先于渲染层接线；IPC 契约先于 UI
- 每个 Checkpoint 独立验证后再进入下一故事

---

## Parallel Opportunities

- Setup：T002/T003 可并行（不同文件）
- Foundational：T004/T005/T006/T007 测试可并行；T008/T013 可与测试并行；T009 后 T010/T011/T012
- US1：T014/T015/T016 测试可并行；T017–T021 按依赖顺序；T022/T023 可穿插
- US2：T024/T025/T026 测试可并行；T027→T028→T030；T029 可与 T028 并行（不同文件）
- US3：T032/T033/T034 测试可并行；T035→T036→T037
- US4：T038/T040/T041 测试可并行；T039 与 T038 同文件，串行；T042→T043/T044/T045
- Polish：T046→T047→T048；T050/T051/T052 可在三端并行人工验证；T053 在 T050–T052 之后串行

---

## Parallel Example: User Story 2

```text
# 测试可并行：
Task: "download/progress/cancel/ready 单元测试 app/tests/unit/main/update-service.test.ts"
Task: "安装握手/未保存守卫集成测试 app/tests/integration/main/update-service.test.ts"
Task: "进度/取消/ready e2e app/tests/e2e/update-flow.spec.ts"

# 实现按依赖：
Task: "updateService.download/cancel app/src/main/update/updateService.ts"
Task: "update:download/cancel/install IPC app/src/main/ipc/registerUpdateIpc.ts"
Task: "UpdateDialog 进度/取消/重启 app/src/renderer/src/dialogs/MoreDialogs.tsx"
Task: "App ready→closeAll→install app/src/renderer/src/App.tsx"
```

---

## Implementation Strategy

### MVP First

**MVP = US1 + US2**：只有「检查 + 下载/安装/重启」合在一起才形成可用的更新闭环；US1 单独可作为“检查/提示”演示。建议顺序：

1. Phase 1 + Phase 2
2. Phase 3（US1）→ 用 mock 适配器验证启动/手动检查
3. Phase 4（US2）→ 验证下载/取消/安装握手/重启
4. **STOP & VALIDATE**：Windows 打包产物 + staging feed 真实更新一次
5. Phase 5（US3）→ 设置独立验收
6. Phase 6（US4）→ 失败/恢复验收
7. Phase 7 → 三端人工验证与发布

### Incremental Delivery

- Setup + Foundational → 状态机/IPC 就绪
- US1 → 检查/提示（可演示）
- US2 → 下载/安装/重启（完整闭环）
- US3 → 安静启动设置
- US4 → 失败恢复
- Polish → 三端发布/签名/灰度

---

## Notes

- `[P]` 任务必须是不同文件、无未完成依赖；同一文件（`updateService.ts`、`App.tsx`、`MoreDialogs.tsx`）内的任务不并行
- 每个用户故事完成后必须独立验证，再进入下一故事
- 真实安装/重启、签名/公证、杀软/提权无法稳定自动化，按 `quickstart.md` §7 人工验证并记录
- 旧 `app/src/main/updater.ts` 及其测试在 US1 被替换删除；不保留第二套检查逻辑
- 发布顺序：先上传安装包/元数据 → 校验 `latest*.yml` → 更新旧版 `/api/version`；测试包不得进正式 feed

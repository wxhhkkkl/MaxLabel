# Tasks: Start Page Member Panel and Edition Authorization Gating

**Input**: Design documents from `/specs/017-start-page-license-gating/`

**Prerequisites**: plan.md（必需）、spec.md（必需）、research.md、data-model.md、contracts/、quickstart.md

**Tests**: 本项目宪法要求 TDD，以下每个阶段都先写失败测试，再实现；测试任务不可省略。

**Organization**: 任务按用户故事分组，每个故事可独立实现、独立测试、独立交付。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: 所属用户故事（US1–US4）
- 每条任务都包含明确文件路径

## Path Conventions

- 桌面应用单仓库：`app/src/main`、`app/src/preload`、`app/src/renderer/src`、`app/src/shared`
- 测试：`app/tests/unit`、`app/tests/contracts`、`app/tests/integration`、`app/tests/e2e`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 建立本特性需要的文案、外部依赖清单与测试开关约定。

- [X] T001 [P] 在 `app/src/shared/i18n/messages.zh-CN.ts` 与 `app/src/shared/i18n/messages.en-US.ts` 增加只读提示、登录/续费/插入加密狗引导、版本升级提示、空态/加载失败文案键
- [X] T002 [P] 在 `app/src/shared/i18n/errors.en-US.ts` 增加 `error.entitlementReadOnly` 等授权错误文案，并保持中英键一致
- [X] T003 记录并确认外部输入：D-01（标准/专业/企业矩阵逐项）、D-02（厂商加密狗读取接口）、商城公司名/头像/版本字段；缺失时按 `specs/017-start-page-license-gating/quickstart.md` 的降级路径实现，不阻塞开发

**Checkpoint**: 文案键与外部依赖已明确，可开始基础模块。

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 授权模型、加密狗读取、主进程授权聚合与 IPC；所有用户故事都依赖本阶段。

**⚠️ CRITICAL**: 本阶段完成前不开始 US1–US4。

### 授权模型（shared）

- [X] T004 [P] 先写失败测试：`app/tests/unit/shared/entitlement.test.ts` 覆盖 `Edition`、`FeatureKey`、`FEATURE_MATRIX`、多版本取最高档、到期/加密狗覆盖/本地状态不得提权
- [X] T005 实现 `app/src/shared/domain/entitlement.ts`：`Edition`、`FeatureKey`、`FEATURE_MATRIX`、`resolveEntitlement(input)`、`editionLabel`（字段与不变量见 `data-model.md`）
- [X] T006 [P] 扩展 `app/src/shared/ipcContract.ts`：`MallMember` 增加 `companyName?`（≤100）、`avatarUrl?`（仅 http/https）、`edition`、`subscriptionEndTime?`；`MallPlan` 增加 `edition`；新增 `DongleState`、`EntitlementState`、`EntitlementStatusResult`

### 加密狗读取（main）

- [X] T007 [P] 先写失败测试：`app/tests/unit/main/dongle.test.ts` 与 `app/tests/integration/main/dongle-reader.test.ts` 覆盖匹配/未插入/未写入/读取失败/过期/打包环境忽略开发配置/2 秒内状态变化
- [X] T008 实现 `app/src/main/dongle/dongleReader.ts`（接口、状态 diff、1 秒轮询，保证 2 秒内反映）、`app/src/main/dongle/windowsVolumeReader.ts`（系统命令读取卷标/序列号）、`app/src/main/dongle/vendorDongleReader.ts`（D-02 接口占位）；读取失败一律无效；开发适配器只在非打包构建生效
- [X] T009 在 `app/src/main/index.ts` 启动/停止加密狗轮询，并接入授权变更回调

### 授权聚合与 IPC（main/preload）

- [X] T010 [P] 先写失败测试：`app/tests/integration/main/entitlement-service.test.ts` 覆盖会员+加密狗聚合、离线快照到期、网络失败保留凭据、401 清除凭据、登录/续费/插拔推送；`app/tests/contracts/entitlement-ipc.test.ts` 覆盖通道唯一性/白名单
- [X] T011 实现 `app/src/main/entitlementService.ts`：读取会员订阅与加密狗、计算状态、持久化离线快照（`secureJsonStore`）、仅在变化时通知；区分 401 与网络失败，网络失败不得清除有效凭据/快照（必要时调整 `app/src/main/mallAuth.ts` 的 `readMallSession`）；日志不得出现完整手机号或凭据
- [X] T012 在 `app/src/shared/ipcContract.ts` 增加 `entitlementStatus`/`entitlementChanged` 通道；实现 `app/src/main/ipc/registerEntitlementIpc.ts`；扩展 `app/src/preload/index.ts` 的 `entitlement.status()`/`onChanged()`；在 `app/src/main/index.ts` 注册
- [X] T013 [P] 在 `app/src/main/ipc/registerTemplateIpc.ts` 为 `template:save`/`template:saveTo`/`template:saveToLib`、在 `app/src/main/ipc/registerMallIpc.ts` 为 `mall:template-save`/`mall:template-share`/`mall:template-unshare` 增加 `editable=false` 二次校验；先补 `app/tests/integration/main/template-ipc.test.ts` 与 `app/tests/integration/main/mall-save-guard.test.ts` 失败用例
- [X] T014 实现仅非打包环境生效的测试注入 `MAXLABEL_TEST_ENTITLEMENT`（`readonly|standard|professional|enterprise|dongle`），并补单元测试断言 `app.isPackaged=true` 时忽略、开发适配器不得作为发布有效性来源；不得进入打包产物

### 渲染层授权状态

- [X] T015 [P] 先写失败测试：`app/tests/unit/renderer/entitlement-guards.test.ts` 覆盖状态映射、只读命令守卫、提示文案
- [X] T016 实现 `app/src/renderer/src/features/entitlement/useEntitlements.ts`（订阅 `entitlement:status` 与 `onChanged`）、`app/src/renderer/src/features/entitlement/entitlementGuards.ts`（统一拒绝与提示）

**Checkpoint**: 授权模型、加密狗、IPC、渲染层状态可用；可开始各用户故事。

---

## Phase 3: User Story 1 - 未授权时保持只读 (Priority: P1) 🎯 MVP

**Goal**: 无有效会员且无有效加密狗时，禁止新建/修改/保存；允许打开、查看、预览、打印；授权后同一会话恢复。

**Independent Test**: 以 `MAXLABEL_TEST_ENTITLEMENT=readonly` 启动，逐一验证新建、对象工具、菜单编辑项、快捷键、粘贴/删除/保存均被拒；打开本机/云端模板、预览、打印可用；切换为 `standard` 后编辑恢复。

### Tests

- [X] T017 [P] [US1] 在 `app/tests/unit/renderer/editor-menus.test.ts` 与 `app/tests/unit/renderer/editor-availability.test.ts` 写失败用例：只读时所有创建/修改命令禁用，查看/打开/打印可用
- [X] T018 [P] [US1] 在 `app/tests/e2e/start-page-entitlement.spec.ts` 写只读 e2e：新建/修改/保存被拒、打开/预览/打印可用、授权切换后恢复；编辑中授权失效（到期/拔狗）时标签页与未保存内容保留
- [X] T019 [P] [US1] 在 `app/tests/integration/renderer/read-only-print.test.ts` 写失败用例：只读打印不推进序列号、不自动保存

### Implementation

- [X] T020 [US1] 扩展 `app/src/renderer/src/features/editor/editorAvailability.ts` 与 `app/src/renderer/src/features/commands/labelShopMenus.ts`：接收 `entitlement`，只读时禁用 `editDocuments` 相关项，保留打开/打印/查看
- [X] T021 [US1] 在 `app/src/renderer/src/App.tsx` 包装 `applyDocument`、`undo`、`redo`、`requestNew`、`handleTool`、`handleCreateAt`、`handleCreateRect`、剪贴板、删除、保存入口，统一走 `entitlementGuards`
- [X] T022 [US1] 在 `app/src/renderer/src/editor/Toolbar.tsx` 与 `app/src/renderer/src/features/commands/useLabelShopShortcuts.ts` 接线只读禁用与提示，保证菜单/工具栏/快捷键一致
- [X] T023 [US1] 在 `app/src/renderer/src/App.tsx` 或新组件 `app/src/renderer/src/features/entitlement/ReadOnlyNotice.tsx` 增加只读状态条与“登录/续费/加密狗”操作入口；补测试断言从提示 1 次点击即可到达对应入口
- [X] T024 [US1] 在 `app/src/renderer/src/App.tsx`/`app/src/renderer/src/features/printing/printJob.ts` 处理只读打印：允许打印，但跳过 `advanceDocumentSerials` 与自动保存
- [X] T025 [US1] 在 `app/tests/e2e/start-page-entitlement.spec.ts` 增加主进程保存拦截的端到端断言：只读时即使绕过 UI 直接触发保存，也被 `template:save*`/`mall:template-save*` 拒绝并给出同一提示

**Checkpoint**: 只读门槛可独立验收；US1 即 MVP。

---

## Phase 4: User Story 2 - 起始页左侧会员面板 (Priority: P1)

**Goal**: 左栏显示头像、脱敏手机号、公司名称、当前版本、有效期、购买/续费、商城入口；未登录先登录。

**Independent Test**: 分别以未登录、标准版会员、公司名缺失、过期会员启动，检查左栏显示与购买流程。

### Tests

- [X] T026 [P] [US2] 在 `app/tests/unit/renderer/start-page.test.ts` 写失败用例：资料缺失降级（默认头像/“未填写”）、版本/订阅状态/到期文案、未登录登录入口
- [ ] T027 [P] [US2] 在 `app/tests/e2e/start-page-entitlement.spec.ts` 写左栏 e2e：登录/未登录、购买先登录、商城入口；登录后 2 秒内左栏信息更新；记录并断言到达购买/续费页的点击次数（已登录 ≤3、未登录 ≤5）【未完成：点击计数与真实登录需商城测试账号，留给 T054 人工验收】

### Implementation

- [X] T028 [US2] 扩展 `app/src/main/mallRepository.ts` 的 `fetchMallMember`/`fetchMallSubscription`/`fetchMallPlans` 与 `app/src/main/mallAuth.ts`：映射 `companyName`/`avatarUrl`/`edition`/`endTime`/`activeEditions`，套餐保留 `edition` 且丢弃无版本套餐，无有效版本按 `none`；补 `app/tests/integration/main/mall-repository.test.ts` 失败用例
- [X] T029 [US2] 新建 `app/src/renderer/src/pages/start/ProfileCard.tsx`，实现头像/脱敏手机号/公司名/会员版本/有效期/购买/商城；仅加密狗时显示“加密狗（全部功能）”；补断言 UI 不出现完整手机号
- [X] T030 [US2] 重构 `app/src/renderer/src/pages/StartPage.tsx` 为左右两栏，左栏接入 `ProfileCard`
- [X] T031 [US2] 在 `app/src/renderer/src/App.tsx` 实现购买流程：未登录先调用 `mall.login`，登录后通过商城购买深链打开购买/续费页（未提供深链时落到 `/mall` 并记录依赖）；复用 `mall:open` 与 `MallAccountDialog` 的入口
- [X] T032 [US2] 在 `app/src/renderer/src/styles.css` 增加左栏样式、只读/过期视觉状态，并补 `app/src/renderer/src/dialogs/MallAccountDialog.tsx` 的版本套餐展示（按 `contracts/mall-api.md`）

**Checkpoint**: 左栏可独立验收。

---

## Phase 5: User Story 3 - 起始页右侧内容随登录态变化 (Priority: P2)

**Goal**: 未登录显示 banner、最近模板、公共云模板库；登录后显示“我的云模板”；banner/最近模板保留。

**Independent Test**: 未登录/登录两种状态启动，检查右栏三区、空态、加载失败、加载模板只读打开。

### Tests

- [X] T033 [P] [US3] 在 `app/tests/unit/renderer/start-page.test.ts` 写失败用例：右栏分区选择、空态、错误/重试、登录态切换
- [ ] T034 [P] [US3] 在 `app/tests/e2e/start-page-entitlement.spec.ts` 写右栏 e2e：未登录/登录切换（2 秒内切换且最近模板不丢失）、加载公共与我的云模板；未登录点击需登录模板后完成登录并继续打开该模板【未完成：登录后切换需真实商城账号，当前 e2e 覆盖未登录三区与云区域状态；真实切换留给 T054】

### Implementation

- [X] T035 [P] [US3] 新建 `app/src/renderer/src/pages/start/PromoBanner.tsx` 与 `RecentTemplates.tsx`（复用 `useRecentTemplates`）
- [X] T036 [US3] 新建 `app/src/renderer/src/pages/start/CloudTemplates.tsx`：未登录走公共模板列表，登录走 `mall.templates.list`；加载走现有 `openDoc`，只读允许；空态/错误/重试；需登录的模板登录成功后自动续开
- [X] T037 [US3] 在 `app/src/renderer/src/pages/StartPage.tsx` 接入右栏三区；移除 iframe 商城与 `startView` 的 `mall` 分支
- [X] T038 [US3] 移除 `app/src/main/mallService.ts` 的 `seedEmbeddedMallFrames`/`watchEmbeddedMallSession` 与 `app/src/main/index.ts` 的监听，同步删除/改写 `app/tests/integration/main/mall-service.test.ts` 与 `app/tests/INDEX.md` 对应条目
- [X] T039 [US3] 在 `app/src/renderer/src/styles.css` 增加右栏内容区、banner、列表、空态样式

**Checkpoint**: 右栏可独立验收；US2+US3 组成完整起始页。

---

## Phase 6: User Story 4 - 不同版本的功能差异 (Priority: P2)

**Goal**: 标准/专业/企业按矩阵限制功能；受限项在菜单/工具栏/快捷键一致锁定并提示升级；加密狗解除全部限制。

**Independent Test**: 以 `standard|professional|enterprise|dongle` 启动，对照 `data-model.md` 的矩阵逐项验证三种入口一致，加密狗全开。

### Tests

- [X] T040 [P] [US4] 在 `app/tests/unit/renderer/editor-menus.test.ts`/`editor-availability.test.ts` 写失败用例：每个 `FeatureKey` 在菜单/工具栏/快捷键的可用性一致
- [X] T041 [P] [US4] 在 `app/tests/e2e/start-page-entitlement.spec.ts` 写三档版本与加密狗 e2e

### Implementation

- [X] T042 [US4] 接线 `databaseSources`：`labelShopMenus.ts`、`app/src/renderer/src/dialogs/DataPanel.tsx`、`app/src/renderer/src/features/data/useDataManagement.ts`
- [X] T043 [US4] 接线 `batchDataSources`：`app/src/renderer/src/dialogs/ObjectPropsDialog.tsx`、`app/src/renderer/src/dialogs/ChangeDataDialog.tsx`
- [X] T044 [US4] 接线 `printHistory`：`labelShopMenus.ts`、`app/src/renderer/src/editor/PrintDock.tsx`、`app/src/renderer/src/dialogs/PrintHistoryDialog.tsx`
- [X] T045 [US4] 接线 `cloudTemplates`：`labelShopMenus.ts`、`app/src/renderer/src/dialogs/CloudTemplateDialog.tsx`、`app/src/renderer/src/dialogs/MallSharedLibraryDialog.tsx`、`app/src/renderer/src/App.tsx` 的云保存/分享
- [X] T046 [US4] 接线 `scripts`：`app/src/renderer/src/dialogs/OptionsDialog.tsx`、`ObjectPropsDialog.tsx`、`ExportModal.tsx`
- [X] T047 [US4] 接线 `scaleAutoPrint`：`app/src/renderer/src/editor/PrintDock.tsx`、`app/src/renderer/src/features/scale/useAutoPrint.ts`
- [X] T048 [US4] 接线 `rfidObjects` 与 `extendedBarcodeTypes`：`app/src/renderer/src/editor/Toolbar.tsx`、`app/src/renderer/src/dialogs/ObjectPropsDialog.tsx`、`app/src/renderer/src/editor/barcodeTypes.ts`；按 `data-model.md` 的常用码制清单划分，不另写条件
- [X] T049 [US4] 在 `app/src/renderer/src/editor/Toolbar.tsx`、`labelShopMenus.ts` 增加锁定标记与“升级/插入加密狗”入口；统一使用 `entitlementGuards` 提示

**Checkpoint**: 三档版本与加密狗行为可独立验收。

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 文档、回归、安全与验收。

- [X] T050 [P] 更新 `app/tests/INDEX.md`：新增授权、只读、起始页、加密狗测试映射
- [X] T051 [P] 检查中英文文案与空态/错误态全覆盖（`messages.*`、`property.en-US.ts`、起始页组件）
- [X] T052 在 `app/src/main/entitlementService.ts` 与 `app/tests/unit/main/entitlement-service.test.ts` 校验打包构建忽略 `MAXLABEL_TEST_ENTITLEMENT`，补一条防回归测试
- [X] T053 使用 `app/package.json` 的脚本运行 `npm test`、`npm run test:e2e`、`npm run build`，修复回归；按 `quickstart.md` 测量起始页首屏 ≤2 秒与断网时 banner/最近模板可用
- [ ] T054 按 `specs/017-start-page-license-gating/quickstart.md` 完成真实商城账号、购买深链与点击计数、真实加密狗的人工验收，并记录结果【未完成：需真实账号与加密狗；自动化部分已由 `start-page-entitlement.spec.ts` 覆盖】
- [X] T055 复核 `specs/017-start-page-license-gating/plan.md` 的 Constitution Check：先测试后实现、无第二套几何/打印规则、新增 IPC 已批准；更新 `app/tests/INDEX.md` 与文档

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，可立即开始
- **Foundational (Phase 2)**: 依赖 Phase 1；**阻塞所有用户故事**
- **US1 (Phase 3)**: 依赖 Phase 2；MVP
- **US2 (Phase 4)**: 依赖 Phase 2；可与 US1 并行（不同文件）
- **US3 (Phase 5)**: 依赖 Phase 2；可与 US1/US2 并行
- **US4 (Phase 6)**: 依赖 Phase 2；建议在 US1 完成后接线，因其复用只读守卫
- **Polish (Phase 7)**: 依赖所有目标故事完成

### User Story Dependencies

- **US1（P1，MVP）**：只依赖 Foundational；实现只读门槛与保存拦截
- **US2（P1）**：只依赖 Foundational；左栏资料与购买入口；不依赖 US1 的只读逻辑
- **US3（P2）**：只依赖 Foundational；右栏内容；与 US2 共享 `StartPage.tsx`，需协调文件冲突
- **US4（P2）**：依赖 Foundational + US1 的 `entitlementGuards`；功能矩阵接线

### Within Each User Story

- 先写测试并确认失败，再实现；测试失败原因必须是断言失败而非导入/环境错误
- 共享模块（entitlement/guard）先于 UI 接线
- 同一文件的任务串行执行（如 `StartPage.tsx`、`labelShopMenus.ts`）

---

## Parallel Opportunities

- T001/T002（i18n）、T004（测试）、T006（契约）、T007（加密狗测试）、T010（授权服务测试）、T015（守卫测试）可并行
- Foundational 完成后，US1、US2、US3 可由不同开发者并行；US4 在 US1 后开始
- 每个故事内的测试任务（[P]）可并行编写
- 文件冲突提醒：`StartPage.tsx`（T030/T037）、`labelShopMenus.ts`（T020/T042–T045）、`App.tsx`（T021/T023/T024/T031/T045）需串行合并

### Parallel Example: US2

```bash
# 测试先行（可并行）
Task: "start-page.test.ts 资料缺失/版本状态用例"
Task: "start-page-entitlement.spec.ts 左栏 e2e"

# 实现（文件不同，可并行）
Task: "ProfileCard.tsx"
Task: "mallRepository.ts 会员字段映射"
```

---

## Implementation Strategy

### MVP First（US1）

1. 完成 Phase 1 + Phase 2（授权模型、加密狗、IPC、守卫）
2. 完成 US1（只读门槛）
3. **STOP and VALIDATE**：以 `readonly` 与 `standard` 两种注入验证只读/恢复
4. 可先行发布“未授权只读 + 授权后编辑”的最小闭环

### Incremental Delivery

1. Foundational → 授权状态可用
2. US1 → 只读门槛（MVP）
3. US2 → 左栏会员面板与购买入口
4. US3 → 右栏内容与云端模板
5. US4 → 三档功能限制
6. Polish → 全量回归与真实硬件验收

### Parallel Team Strategy

1. 全员完成 Setup + Foundational
2. 之后：A=US1，B=US2，C=US3；US4 待 US1 守卫稳定后由 A 或 D 接手
3. 涉及 `StartPage.tsx`/`App.tsx`/`labelShopMenus.ts` 的任务按文件串行，避免冲突

---

## Notes

- [P] 任务 = 不同文件、无未完成依赖
- 术语：未加限定的“版本”指会员版本；应用自身版本称“软件版本”
- 每个测试任务完成后必须**运行并确认失败**（断言失败，不是导入/环境错误），再开始对应实现
- 每个用户故事必须可独立测试；测试未失败前不写实现
- 不得在矩阵之外临时限制功能；D-01 调整只改 `FEATURE_MATRIX`
- 加密狗读取失败一律无效；测试注入不得进入打包构建
- 只读允许打开/查看/预览/打印；只读打印不推进序列号、不自动保存

## Phase 8: Convergence

- [X] T056 对离线授权快照做完整性保护：`app/src/main/entitlementService.ts` 写入时签名/加密，读取时校验；无法校验或旧版明文快照一律按未授权处理，并补 `app/tests/integration/main/entitlement-service.test.ts` 篡改/旧格式用例 per FR-023/FR-036 (contradicts)
- [X] T057 加固打包构建的加密狗授权：`app/src/main/dongle/dongleReader.ts` 不得信任任意本地 JSON；D-02 到位前发布构建视为未授权，开发期适配器仅非打包生效；补单元测试 per FR-026/FR-023 (contradicts)
- [X] T058 在打印、预览、导出链路统一计算 `effectiveAllowScript = options.allowScript && entitlement.features.scripts`：`app/src/renderer/src/App.tsx`、`app/src/renderer/src/dialogs/ExportModal.tsx`；补测试 per FR-030/FR-034 (partial)
- [X] T059 让所有数据源类型入口共用版本矩阵：`app/src/renderer/src/editor/PropertyPanel.tsx` 的快捷选择器与 `app/src/renderer/src/dialogs/ChangeDataDialog.tsx`（序列号/数据库/日期时间/键盘/脚本）按 `features` 禁用并提示；补测试 per FR-030/FR-034 (partial)
- [X] T060 增加授权失效 e2e：编辑中切换到只读（到期/拔狗）时标签页与未保存内容保留、禁止自动保存、打印可用；写入 `app/tests/e2e/start-page-entitlement.spec.ts` per SC-005 (partial)
- [X] T061 增加起始页首屏 ≤2 秒与断网时 banner/最近模板可用的可重复测量步骤，记录在 `specs/017-start-page-license-gating/quickstart.md` 与 `app/tests/e2e/start-page-entitlement.spec.ts` per SC-007 (partial)
- [X] T062 实现商城购买/续费深链：在 `app/src/shared/config.ts` 与 `app/src/renderer/src/App.tsx` 的 `buyMallMembership` 使用商城提供的路径，未提供时回退 `/mall`；补 `contracts/mall-api.md` 与测试 per FR-006 (partial)
- [ ] T063 实现未登录点击需登录云模板后的续开：`app/src/renderer/src/pages/start/CloudTemplates.tsx` 记录 pending 模板，登录成功后自动加载；补 e2e per FR-015 (partial)【实现已完成：CloudTemplates 增加 pending 续开；e2e 需真实登录账号，待 T034/T054】
- [X] T064 为版本受限功能提供一键升级/插入加密狗入口：在 `app/src/renderer/src/features/entitlement/` 增加共享动作，菜单锁定项与受限对话框复用；补测试 per FR-031 (partial)
- [ ] T065 增加非打包环境的商城会员测试注入或 mock，覆盖左/右栏登录切换、2 秒更新与购买点击计数（T027/T034 的自动化部分）；涉及 `app/src/main/entitlementService.ts` 或测试专用 IPC，并补 `app/tests/e2e/start-page-entitlement.spec.ts` per FR-010/FR-012/SC-003/SC-004 (partial)【已完成会员测试注入与登录态展示 e2e；点击计数仍需真实购买流程，待 T054】
- [X] T066 用 fake timers 覆盖加密狗 1 秒轮询与状态变化后 2 秒内反映，并验证打包/开发适配器选择；补 `app/tests/unit/main/dongle.test.ts` per SC-002/FR-026 (partial)
- [X] T067 增加隐私断言：起始页 UI、日志与 IPC 状态不出现完整手机号/令牌/未脱敏设备标识；补 `app/tests/unit/renderer/start-page.test.ts` 与主进程测试 per FR-035/FR-036 (partial)

## Phase 9: Convergence

- [X] T068 在 `app/src/renderer/src/dialogs/DataSourceEditor.tsx` 中，当当前 `source.kind` 不在版本矩阵允许范围时，整块数据源字段（序列号/数据库/日期时间/键盘/脚本）只读并显示升级提示；覆盖从 `ObjectPropsDialog` 打开既有模板的场景，补测试 per FR-030/FR-034 (partial)
- [X] T069 让主工具栏的锁定图标可点击触发登录/升级：在 `app/src/renderer/src/editor/Toolbar.tsx` 的 `TBtn` 增加 `onLocked` 动作并复用 `app/src/renderer/src/features/entitlement/entitlementActions.ts`；补组件/菜单一致性测试 per FR-031 (partial)
- [X] T070 增加非打包环境的动态会员测试开关（文件或测试 IPC），自动化“未登录→登录”后左/右栏更新、云模板续开与购买点击数；涉及 `app/src/main/ipc/registerMallIpc.ts` 与 `app/tests/e2e/start-page-entitlement.spec.ts` per FR-010/FR-012/FR-015/SC-003/SC-004 (partial)
- [X] T071 让商城购买/续费深链可由商城配置（配置项或接口下发），在 `app/src/renderer/src/App.tsx` 的 `buyMallMembership` 使用该路径并保留 `/mall` 回退；补 `contracts/mall-api.md` 与测试 per FR-006 (partial)

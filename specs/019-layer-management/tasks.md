# Tasks: 真图层（图层管理）

**Input**: Design documents from `specs/019-layer-management/`
**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/ui-contract.md、quickstart.md

**Tests**: 宪法原则 I（测试先行，不可协商）—— 每个故事的测试任务 MUST 先写、先失败，再写实现。

**分支**：`019-layer-management`（当前 git 在 `feat/desktop-1.1.0`，实现前先切）

## Format: `[ID] [P?] [Story] Description`

- **[P]**：可并行（不同文件、无未完成依赖）
- **[Story]**：所属用户故事（US1 / US2 / US3）

## Path Conventions

- 共享层：`app/src/shared/…`；渲染层：`app/src/renderer/src/…`
- 测试：`app/tests/{unit,contracts,integration,e2e}/…`

---

## Phase 1: Setup（共享基线）

- [x] T001 切到 `019-layer-management` 分支，并在 `app/` 下跑基线 `npm run typecheck && npm run test:unit`，记录既有通过状态
- [x] T002 [P] 在 `app/` 下跑基线 `npm run test:contracts && npm run test:integration`，确认无既有失败（作为回归基线）

---

## Phase 2: Foundational（阻塞所有用户故事）

**⚠️ CRITICAL**：本阶段完成前不能进入用户故事。

- [x] T003 [P] 写失败单测 `app/tests/unit/shared/domain/layers.test.ts`：默认图层创建、图层归一化（id 唯一、名称 ≤128 字符、最多 100 个图层）、`isObjectVisible` / `isObjectLocked` 叠加、`orderedObjects` 排序、`objectCountOfLayer` 计数
- [x] T004 [P] 写失败单测 `app/tests/unit/shared/domain/document-migration-layers.test.ts`：v2 文档补 `default` 图层、未知 `layerId` 归默认、group 子对象跟随父组、模型版本升到 3
- [x] T005 [P] 写失败契约测试 `app/tests/contracts/msdx-layers.test.ts`：v3 往返保留 `layers` 与 `layerId`；v2 文件打开后归默认图层
- [x] T006 实现 `app/src/shared/domain/layers.ts`：`Layer` 类型、`DEFAULT_LAYER_ID='default'`、`createDefaultLayer`、`normalizeLayers`、`layerById`、`isObjectVisible`、`isObjectLocked`、`orderedObjects`、`orderedVisibleObjects`、`objectCountOfLayer`
- [x] T007 [P] 扩展 `app/src/shared/domain/objects.ts`：`BaseObj` 增加 `layerId?: string`
- [x] T008 扩展 `app/src/shared/domain/document.ts`：`LabelDoc.layers`、`DOCUMENT_MODEL_VERSION=3`、`migrateDocument` 补默认图层与 `layerId`、`normalizeDocument` 校验图层（id 非空唯一、名称非空 ≤128、≤100 层、至少一个默认图层、未知 layerId 归默认）
- [x] T009 [P] 更新 `app/src/renderer/src/io/msdx.ts`：`MSDX_VERSION=3`（序列化随 normalize 自动带上 layers）

**Checkpoint**：模型、迁移与持久化就绪 → 用户故事可并行开始。

---

## Phase 3: User Story 1 - 用图层组织对象（P1）🎯 MVP

**Goal**：新建图层、把对象移入图层；图层的显隐/锁定作用于其下全部对象；新对象进入活动图层。

**Independent Test**：建「图层 2」并移入一个对象，隐藏/锁定该层只影响该对象；活动层隐藏/锁定时新建被拒。

### Tests for US1（先写、先失败）

- [x] T010 [P] [US1] 单测 `app/tests/unit/renderer/layer-objects.test.ts`：移动对象到图层、对象自身与图层叠加的可见/锁定判定、`orderedObjects` 跨层顺序
- [x] T011 [P] [US1] 集成测试 `app/tests/integration/renderer/layer-commands.test.ts`：`createLayer` / `moveObjectsToLayer` / `setLayerVisible` / `setLayerLocked` 经 `applyDocument` 生效且可一步撤销；**移动分组时组内对象跟随、不跨层**（FR-013）

### Implementation for US1

- [x] T012 [US1] `app/src/renderer/src/features/workspace/useDocumentWorkspace.ts`：`DocTab` 增加 `activeLayerId: string | null`
- [x] T013 [US1] `app/src/renderer/src/features/editor/useDocumentCommands.ts`：新增 `createLayer`、`moveObjectsToLayer`、`setLayerVisible`、`setLayerLocked`、`setActiveLayer`（均走 `applyDocument`，`setActiveLayer` 除外）
- [x] T014 [US1] `app/src/renderer/src/features/editor/useDocumentCommands.ts` 的对象创建路径（`appendObject`、`addImageFile`、粘贴、复制）写入 `layerId = activeLayerId`；活动图层隐藏/锁定时拒绝并提示（Q4=B）
- [x] T015 [US1] `app/src/renderer/src/editor/LayerPanel.tsx`：改为「图层行 + 展开对象」树形；图层行显示可见/锁定/对象数；点击图层行切换活动图层并高亮
- [x] T016 [US1] `app/src/renderer/src/editor/LabelEditor.tsx`：渲染、命中测试、锁定判断改用 `isObjectVisible` / `isObjectLocked` / `orderedObjects`
- [x] T017 [US1] `app/src/renderer/src/App.tsx`：接线 `activeLayerId`、图层命令与面板新 props

**Checkpoint**：US1 可独立验证（图层容器、归属、显隐/锁定传播）。

---

## Phase 4: User Story 2 - 图层面板工具栏与面板重开（P1）

**Goal**：6 个工具栏按钮全部可用；对象属性图层下拉可移动对象；面板关闭后可从菜单重开。

**Independent Test**：逐个点击工具栏按钮；重命名/复制/删除（含非空提示与撤销）；关闭面板后用「查看 → 显示图层窗体」重开。

### Tests for US2（先写、先失败）

- [x] T018 [P] [US2] 集成测试 `app/tests/integration/renderer/layer-panel-actions.test.ts`：重命名、复制（新 id、插在原层上方、成为活动层）、删除非空（提示 N 个对象、连对象删除、可撤销）、`moveLayer` 同时移动对象段
- [x] T019 [P] [US2] 单测 `app/tests/unit/renderer/view-preferences.test.ts` 补充「显示图层窗体」开关与 `showLayerPanel` 持久化

### Implementation for US2

- [x] T020 [US2] `app/src/renderer/src/editor/LayerPanel.tsx`：工具栏 6 个按钮启用并接线（新建/设置/复制/删除/重命名/属性）；组件测试断言 6 个按钮均为 `enabled`（SC-006）
      —— 2026-11-01 所有者要求**去掉「设置」**（它与「图层属性」打开同一个对话框，属重复入口）：
      工具栏现为 **5 个**（新建 / 复制 / 删除 / 重命名 / 属性），e2e 断言同步改为 5 个。
      **SC-006 正文仍写「6 个按钮」**，与实现不一致，需所有者决定是否修订该条
- [x] T021 [US2] 新增 `app/src/renderer/src/dialogs/LayerPropsDialog.tsx`（名称/可见/锁定三项），并在 `app/src/renderer/src/editor/LayerPanel.tsx` 接「图层属性」入口
- [x] T022 [US2] `app/src/renderer/src/features/editor/useDocumentCommands.ts`：`renameLayer`（非空、≤128、重名提示）、`copyLayer`（Q2/Q6）、`deleteLayer`（Q1/Q5；**拒绝删除默认图层、空图层保留**）、`moveLayer`（R2）
- [x] T023 [US2] `app/src/renderer/src/dialogs/ObjectPropsDialog.tsx`：「图层」下拉启用，列出 `doc.layers`，变更写 `layerId`（分组整组移动）
- [x] T024 [US2] `app/src/renderer/src/features/commands/appMenus.ts` 与 `App.tsx`：查看菜单补回「显示图层窗体」，面板 × 关闭时置 false，菜单勾选重开（R10）

**Checkpoint**：US1 + US2 均可独立验证；面板与工具栏完整可用。

---

## Phase 5: User Story 3 - 图层随模板保存与打印（P2）

**Goal**：保存/打开保留图层；旧模板归默认图层；打印排除隐藏图层、保留锁定图层。

**Independent Test**：建两层保存重开结构完整；打开 v2 模板对象全在默认层；隐藏图层后打印预览不出现其对象。

### Tests for US3（先写、先失败）

- [x] T025 [P] [US3] 契约测试补充 `app/tests/contracts/msdx-layers.test.ts`：保存→打开保留顺序/显隐/锁定/归属；v2→v3 迁移
- [x] T026 [P] [US3] 集成测试 `app/tests/integration/renderer/layer-print.test.ts`：`scene`/`serialBounds` 收到的对象已排除隐藏图层，锁定图层保留
- [x] T027 [P] [US3] 单测 `app/tests/unit/shared/domain/lsdx-import-layers.test.ts`：lsdx 导入文档全部归默认图层

### Implementation for US3

- [x] T028 [US3] 打印入口（`App.tsx` 打印、`features/printing/printJob.ts`）改用 `orderedVisibleObjects(doc)` 生成对象列表
- [x] T029 [US3] `app/src/shared/print/scene.ts` 与 `serialBounds.ts`：确认只消费已排序/过滤的列表，不直接读 `doc.layers`
- [x] T030 [US3] `app/src/renderer/src/io/lsdxImport.ts`：产出文档经 `normalizeDocument` 自动归默认图层（补测试即可，不写额外映射）

**Checkpoint**：三个故事全部可独立验证。

---

## Phase 6: Polish & 跨故事收尾

- [x] T031 [P] 补齐 i18n：`app/src/shared/i18n/toolbar.zh-CN.ts` 与 `toolbar.en-US.ts` 的新文案（显示图层窗体、图层属性、删除确认、活动图层提示等）
- [x] T032 [P] 更新 `app/tests/helpers/editorShell.ts` 中与图层面板相关的辅助函数（如 props 变化）
- [x] T033 在 `app/` 下跑全量 `npm test`（typecheck + unit + contracts + integration），确认全绿
      —— 2026-11-01 实跑：`typecheck:web` 通过；unit/contracts/integration **1108/1109 通过**。
      两处**既有**红均与 019 无关：① `tests/integration/renderer/color-vector.test.ts` 缺 jsdom 环境；
      ② `typecheck:test` 在 8 个未改动测试文件里有 25 处 `Record<string, unknown>` 转换错误
- [x] T034 在 `app/` 下跑一次定向 e2e `app/tests/e2e/layer-management.spec.ts`（图层面板流程），不跑全量（约 5.5 分钟，沿用既有节奏）
- [ ] T035 按 `quickstart.md` §1~§6 手工走查并记录 SC-001~SC-006
- [x] T036 更新 `docs/功能缺口清单.md` 第 283 条：标记「真图层」已实现（或收窄剩余项）

---

## Dependencies & Execution Order

- **Phase 1**：无依赖
- **Phase 2**：依赖 Phase 1，**阻塞所有用户故事**
- **US1（Phase 3）**：依赖 Phase 2；是 US2 的面板基础
- **US2（Phase 4）**：依赖 Phase 2；与 US1 共享 `LayerPanel`/命令文件，建议在 US1 之后串行
- **US3（Phase 5）**：依赖 Phase 2；持久化测试可早于 US2，打印接入依赖 US1 的有效可见函数
- **Phase 6**：依赖三个故事完成

### Parallel Opportunities

- T003 / T004 / T005（三个测试文件）可并行
- T007 / T009 可在 T008 之后并行
- T010 / T011 可并行
- T018 / T019 可并行
- T025 / T026 / T027 可并行

---

## Parallel Example: US1

```bash
# 测试先行（两个文件互不依赖）：
Task: "T010 单测 layer-objects.test.ts"
Task: "T011 集成测试 layer-commands.test.ts"

# 实现按「状态 → 命令 → 面板 → 画布 → 接线」串行
```

---

## Implementation Strategy

- **MVP**：US1（图层容器 + 对象归属 + 显隐/锁定传播）即可独立演示。
- **可上线**：US1 + US2 + US3（工具栏、对象属性、持久化与打印）。
- 每个阶段结束跑一次定向测试；TDD 顺序不可颠倒（宪法原则 I）。
- 文档格式版本 v3 已获所有者确认（plan 的 Owner Sign-off）；实现时保留「旧版本拒绝 v3」的明确提示。

---

## Notes

- [P] = 不同文件、无未完成依赖
- 每个用户故事独立可测；测试先于实现
- 图层操作必须经 `applyDocument`，一次用户动作一步撤销
- 不新增依赖、不引入 UI 组件库

---

## Phase 7: Convergence

> 2026-11-01 `/speckit-converge` 对当前代码的核查结果（22 条 FR / 6 条 SC / 10 条计划决策）。

- [x] T037 在 `app/tests/e2e/layer-management.spec.ts` 断言图层面板工具栏 6 个按钮（`layer-tool-new` / `settings` / `copy` / `delete` / `rename` / `properties`）全部可见且 `enabled`（无 `disabled` 属性），补齐 T020 承诺的 SC-006 验证 per `T020` / `SC-006`（partial）

---

## Phase 8: Convergence

> 2026-11-01 第二次 `/speckit-converge`（T037 完成后复核）。

- [x] T038 删除 `app/src/renderer/src/features/editor/useDocumentCommands.ts` 中无调用方的 `moveSelectionToLayer` 及其返回值条目（真正在用的是 `moveObjectsToLayerById`）；若确有保留理由，在注释中写明 per `T013`（unrequested）

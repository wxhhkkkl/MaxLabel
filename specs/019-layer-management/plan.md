# Implementation Plan: 真图层（图层管理）

**Branch**: `019-layer-management` | **Date**: 2026-11-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/019-layer-management/spec.md`

## Summary

把图层面板从「对象平铺列表」升级为**真图层**：

- 文档模型新增 `layers`（id / 名称 / 可见 / 锁定 / 顺序），每个对象新增 `layerId`。
- 图层面板变成「图层 → 对象（含分组）」树；工具栏 6 个按钮全部可用（新建/设置/复制/删除/重命名/属性）。
- 图层的可见/锁定传播到其下全部对象；图层顺序决定跨层叠放；对象属性「图层」下拉可移动对象。
- 关闭图层面板后可从「查看 → 显示图层窗体」重新打开。
- msdx 持久化保留图层；旧模板与 lsdx 导入归入默认图层；打印按图层可见性过滤。
- 所有图层操作走现有 `applyDocument`，因此天然进入撤销/重做。

## Technical Context

**Language/Version**: TypeScript、Electron、React、Fabric.js（沿用现有栈）

**Primary Dependencies**: 不新增依赖。复用 `shared/domain`、`useDocumentHistory`、`useDocumentCommands`、`fabricObjects`、`shared/print/scene`。

**Storage**: `.msdx`（JSON 信封 + LabelDoc）。**文档模型版本需要从 2 升到 3**（见 Owner Sign-off）；不改数据库、不改 IPC 通道。

**Testing**: Vitest（unit / contracts / integration）+ Playwright（Electron e2e）。按宪法原则 I 先写失败测试。

**Target Platform**: Windows / macOS / Linux 桌面端

**Project Type**: Electron 桌面应用（main / preload / renderer / shared）

**Performance Goals**: 数十个图层、单层数百对象下列表与画布操作无可感知卡顿；图层显隐切换在 100ms 内反映到画布。

**Constraints**:
- 分层约束不变：`renderer` 不直接编排打印协议；几何/打印规则只存在一份。
- 不引入 UI 组件库；沿用现有 `LayerPanel` / `Dialog` 样式。
- 旧模板、旧导入文件必须能打开，对象不得丢失。
- 图层操作必须可撤销，一次用户动作对应一步。

**Scale/Scope**: 单桌面应用；约 15~20 个源文件 + 对应测试。

## Constitution Check

| 原则 | 结论 | 说明 |
|---|---|---|
| I. 测试先行 | PASS | 先写单元（layers 归一化/排序/传播）、契约（msdx 往返）、集成（命令 + undo + 打印过滤），再写实现；e2e 覆盖面板主流程 |
| II. 先澄清 | PASS | Q1~Q6 已拍板（删除/复制/叠放/活动图层边界） |
| III. 巨大架构变更先确认 | **PASS** | 新增 `layers` 字段并提升文档模型版本，属于「改变核心数据模型与持久化格式」。所有者已于 **2026-11-01** 确认按方案 A（v2 → v3）执行，见 Owner Sign-off |
| 分层与边界 | PASS | 图层是 `shared/domain` 的数据 + 纯函数；面板与画布只消费 shared 的排序/过滤结果 |
| 最小改动 | PASS | 不重构编辑器；在现有面板、对象属性、打印 scene 的既有过滤点接入；保留现有对象级显隐/锁定语义 |
| 增量可验证 | PASS | 阶段 1 模型与持久化 → 阶段 2 面板与命令 → 阶段 3 打印与兼容，每阶段可独立验证 |

## 关键设计决策

完整论证见 [research.md](research.md)（R1~R10）：

| # | 决策 |
|---|---|
| R1 | 图层存 `doc.layers: Layer[]`，对象只存 `layerId`；不改成「每图层一个对象数组」，避免重写整个编辑/打印链路 |
| R2 | `doc.objects` 仍是唯一 z-order 来源；渲染/打印时按「图层顺序 → 层内顺序」排序（`orderedObjects(doc)`），图层上移/下移即移动整段对象 |
| R3 | 有效可见/锁定用 shared 纯函数：对象自身 `visible/locked` 与所属图层叠加；所有现有过滤点改用该函数 |
| R4 | 旧模板迁移：`migrateDocument` 在文档没有 `layers` 时补默认图层并给所有对象（含分组子项）补 `layerId` |
| R5 | msdx 信封版本 2 → 3；旧版本客户端拒绝打开 v3（不静默丢图层），回滚方式见 Owner Sign-off |
| R6 | lsdx 导入没有图层信息 → 全部归默认图层；本仓库没有 lsdx 导出，无需处理导出兼容 |
| R7 | 图层面板改为「图层行 + 展开的对象行」；活动图层保存在 `DocTab.activeLayerId`（每个标签页独立） |
| R8 | 删除非空图层连同对象删除（Q1）；复制连同对象且新 id（Q2）；副本放原层上方并成为活动图层（Q6） |
| R9 | 打印：`shared/print/scene` 与 `serialBounds` 接收的 objects 由 `orderedVisibleObjects(doc)` 生成，图层隐藏的对象不进入场景 |
| R10 | 面板重开：`查看` 菜单补回「显示图层窗体」，复用现有 `showLayerPanel` 偏好（`viewPreferences`） |

## 代码落点

```text
app/src/shared/domain/
├── layers.ts                       # 新增：Layer 类型、DEFAULT_LAYER_ID、归一化、排序、有效可见/锁定
├── document.ts                     # LabelDoc.layers、migrateDocument 3.0、normalizeDocument
└── objects.ts                      # BaseObj.layerId

app/src/renderer/src/
├── editor/LayerPanel.tsx           # 树形面板、工具栏、图层行、活动图层、增删改复制
├── editor/LabelEditor.tsx          # 渲染顺序、命中测试、有效显隐/锁定、新对象归属活动图层
├── dialogs/ObjectPropsDialog.tsx   # 「图层」下拉启用并列出全部图层
├── features/workspace/useDocumentWorkspace.ts  # DocTab.activeLayerId
├── features/editor/useDocumentCommands.ts      # 图层命令 + 对象换层（走 applyDocument）
├── features/commands/appMenus.ts   # 查看 → 显示图层窗体
├── App.tsx                         # 活动图层状态、命令接线、面板渲染
└── io/msdx.ts                      # 信封版本与图层字段（随 normalize 自动）

app/src/shared/print/
└── scene.ts / serialBounds.ts      # 图层可见性过滤与顺序
```

**测试落点**

| 层 | 文件/范围 |
|---|---|
| unit（shared） | `layers` 的创建/归一化/有效可见与锁定/排序；`migrateDocument` 旧文档迁移 |
| unit（renderer） | 图层命令（新建/复制/删除/重命名/移动对象）与 `applyDocument` 撤销 |
| contracts | msdx 往返保留图层；旧 msdx v2 打开后归默认图层 |
| integration | 图层面板交互（创建/重命名/复制/删除/显隐/锁定/移动对象） |
| e2e | 主流程：建两层 → 移对象 → 隐藏/锁定 → 保存重开 → 打印预览过滤 |

## Owner Sign-off（原则 III，需确认）

本次会改变**核心数据模型与模板格式**：

| 方案 | 行为 | 代价 / 回滚 |
|---|---|---|
| **A（推荐）** 文档模型版本 2 → 3 | 新模板带 `layers`；旧版本客户端打开 v3 会提示「版本不受支持」 | 数据不会被静默降级；回滚 = 用本版本另存为 v2（需保留降级写出口）或回退版本后重做编辑 |
| B 保持 v2，`layers` 作为可选字段 | 旧客户端能打开，但会忽略图层，保存后图层信息丢失 | 兼容性最好，风险是**静默丢图层** |
| C 双写 / 特性开关 | 新旧客户端都能开，但实现复杂，需要两套读写 | 成本最高，本期不建议 |

**所有者已确认（2026-11-01）**：按方案 A 执行（文档模型版本 2 → 3）。回滚仍按上表执行：旧版本客户端拒绝打开 v3，需用本版本或提供「另存为 v2」的降级出口。

## Complexity Tracking

无原则违规需要豁免。两处需要说明的取舍：

| 取舍 | 原因 | 更简单替代为何不可行 |
|---|---|---|
| 保留 `doc.objects` 作为唯一 z-order，按图层顺序派生渲染顺序 | 不重写画布、打印与命中测试的数组语义 | 改成「每层一个数组」要重写所有对象遍历与持久化 |
| 提升文档模型版本 | 图层必须持久化；旧客户端静默丢图层风险更高 | 保持 v2 会静默丢数据，违背 SC-003 |

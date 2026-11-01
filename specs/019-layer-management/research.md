# 技术决策与被否决方案（019 真图层）

本文件记录 Phase 0 的调研结论。

---

## R1 —— 图层存在哪里？**`doc.layers` + 对象 `layerId`**

**决策**：`LabelDoc` 增加 `layers: Layer[]`（id、name、visible、locked、顺序由数组顺序表示）；
`BaseObj` 增加 `layerId?: string`。`doc.objects` 结构不变。

**理由**：

1. 现有画布、命中测试、打印、导入导出全部按 `doc.objects` 数组工作；改成「每层一个对象数组」
   要重写所有遍历与持久化，回归面远超本特性。
2. 对象只存一个 `layerId`，图层信息单点维护；隐藏/锁定/改名不需要批量改对象。
3. 旧模板没有 `layers` → 迁移时补默认图层，成本最低。

**被否决**：把对象直接挂在图层下（`layer.objects`）—— 与现有数组语义冲突；
给对象复制一份图层可见/锁定快照 —— 切换图层后要遍历全部对象回写，容易不一致。

---

## R2 —— 图层顺序与对象叠放？**派生渲染顺序，不改数组**

**决策**：`doc.objects` 仍是唯一的 z-order 来源；渲染、命中测试与打印使用
`orderedObjects(doc)`：按 `doc.layers` 从底到顶，把每层的对象按其在 `doc.objects` 中的相对顺序排出来。
图层上移/下移时，同时把该层的对象在 `doc.objects` 中整段移动，保证两者不打架。

**理由**：Fabric 与打印 scene 都按数组顺序画；派生列表让「图层顺序」立即生效，又不需要
改变对象数组的结构。

**被否决**：只在渲染时排序、不动 `doc.objects` —— 对象级「上移/下移」会与图层顺序互相覆盖，
出现「面板顺序和画布顺序不一致」；整段移动更容易测。

---

## R3 —— 有效可见/锁定怎么算？**shared 纯函数**

**决策**：`shared/domain/layers.ts` 提供：

- `isObjectVisible(doc, object)`：`object.visible !== false` 且所属图层 `visible !== false`
- `isObjectLocked(doc, object)`：`object.locked === true` 或所属图层 `locked === true`
- `orderedObjects(doc)` / `orderedVisibleObjects(doc)`

**理由**：目前 `visible !== false` 的判断散落在 App、LabelEditor、fabricObjects、print/scene、
serialBounds 等 8 处；逐处改容易漏，集中成一个纯函数后所有入口一致。

**被否决**：切换图层时批量改写对象 `visible` —— 会丢失「对象自身被单独隐藏」的信息，
取消隐藏图层时把不该出现的对象放出来。

---

## R4 —— 旧模板怎么迁移？**migrateDocument 补默认图层**

**决策**：文档模型版本 2 → 3。`migrateDocument` 检测 `layers`：
不存在则创建默认图层（id `default`、名称「默认」、可见、未锁定），并给 `doc.objects` 里
所有对象（含 group 子项递归）补 `layerId = 'default'`。

**理由**：旧模板与旧导入文件没有图层信息；统一归默认图层，显示状态不变（SC-004）。

**被否决**：按对象类型自动分层 —— 会改变用户看到的图层结构，属于臆造。

---

## R5 —— msdx 版本怎么处理？**升到 v3，旧客户端拒绝**

**决策**：`DOCUMENT_MODEL_VERSION` 与 `MSDX_VERSION` 升到 3；`fromDocJson` 遇到
`version > 3` 继续拒绝。旧版本客户端打开 v3 会提示「模板文件版本不受支持」。

**理由**：真图层必须持久化；让旧客户端打开后静默丢掉图层，风险高于一次明确的版本拒绝。
回滚：旧版本客户端仍可打开 v2 文件；本版本保存的 v3 需要用本版本打开或提供「另存为 v2」的降级写出口
（是否提供降级出口见 Owner Sign-off）。

**被否决**：保持 v2 加可选字段 —— 旧客户端保存会丢图层（SC-003 失败）。

---

## R6 —— lsdx / msdx 兼容？**lsdx 只进默认图层**

**决策**：`lsdxImport` 产出的文档没有图层信息，归一化时全部归默认图层；
本仓库没有 lsdx 导出路径，不需要处理「导出时丢图层」。msdx 往返保留图层。

**理由**：仓库现有 I/O 只有 `io/lsdxImport.ts` 与 `io/msdx.ts`，没有 lsdx 导出。

**被否决**：为 lsdx 设计图层扩展标签 —— 对方格式未确认，属于臆造协议。

---

## R7 —— 面板与活动图层？**DocTab 持有 activeLayerId**

**决策**：`DocTab` 增加 `activeLayerId: string | null`；图层面板显示「图层行 + 展开对象」；
点击图层行切换活动图层；新对象创建时写入 `activeLayerId`（若该层隐藏/锁定则拒绝新建并提示，Q4）。

**理由**：活动图层是**每个标签页**的状态，不属于文档（不持久化），放在 `DocTab` 与现有
`selectedId`、`zoom` 等 UI 状态一致。

**被否决**：把活动图层存进 `LabelDoc` —— 会污染模板数据，且不同窗口打开同一模板时不应共享。

---

## R8 —— 删除 / 复制图层的具体动作？**按 Q1 / Q2 / Q6**

**决策**：

- 删除：从 `layers` 移除该层，同时从 `doc.objects` 删除 `layerId` 命中的对象（含分组整体）；
  操作前提示对象数量；一次 `applyDocument` → 一步撤销。
- 复制：复制图层字段，深拷贝其对象并重新生成 id；副本插入原图层上方，设为活动图层。
- 删除活动图层后按「上一个 → 下一个 → 默认」切换（Q5）。

**理由**：删除与复制都必须是一次可撤销的用户动作；复制生成新 id 避免与原对象冲突。

**被否决**：删除只删图层、把对象移到默认层 —— 与 Q1 拍板不符。

---

## R9 —— 打印如何过滤？**scene 接收已排序/过滤的对象**

**决策**：打印入口（`App` 打印与 `printJob`）用 `orderedVisibleObjects(doc)` 生成对象列表，
再交给 `shared/print/scene`；`serialBounds` 同样使用该列表。已有 `visible/suppressPrint`
过滤保持不变，图层只在其前一层生效。

**理由**：打印协议适配器不感知图层（分层约束）；在进入 shared 之前完成排序与过滤，规则只写一处。

**被否决**：在 scene 内部解析 `doc.layers` —— 会让打印层依赖文档图层结构，扩大耦合。

---

## R10 —— 面板关闭后重开？**查看菜单 + 现有偏好**

**决策**：在「查看」菜单补回「显示图层窗体」勾选项，绑定现有 `showLayerPanel` 偏好
（`viewPreferences`，默认 true）；面板关闭（×）时把它置 false，菜单勾选即重开。

**理由**：`toggleLayerPanel` 与 `showLayerPanel` 已存在，只缺菜单入口；补齐成本极低。

**被否决**：仅靠快捷键或右键菜单 —— 用户找不到入口，违背 FR-015。

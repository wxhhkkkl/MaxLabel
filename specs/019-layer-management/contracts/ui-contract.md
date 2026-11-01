# 界面与状态契约（019 真图层）

> 本特性没有服务端接口；这里的「契约」是 renderer 内部组件 / 命令 / 持久化格式的约定，
> 供计划与实现验收使用。

---

## 1. `LayerPanel` 组件

### Props

| Prop | 类型 | 说明 |
|---|---|---|
| `doc` | `LabelDoc` | 需要图层与对象（不再只传 objects） |
| `layers` | `Layer[]` | 从底到顶 |
| `objects` | `LabelObject[]` | 原始对象数组（用于统计与树形展开） |
| `activeLayerId` | `string \| null` | 活动图层 |
| `selectedId` | `string \| null` | 当前选中对象 |
| `onSelectLayer` | `(id: string) => void` | 点击图层行 |
| `onCreateLayer` | `() => void` | 新建 |
| `onCopyLayer` | `() => void` | 复制 |
| `onDeleteLayer` | `() => void` | 删除（内部先弹提示） |
| `onRenameLayer` | `() => void` | 重命名 |
| `onLayerProperties` | `() => void` | 图层属性 |
| `onToggleLayerVisible` | `(id: string) => void` | 图层显隐 |
| `onToggleLayerLock` | `(id: string) => void` | 图层锁定 |
| `onMoveLayer` | `(id: string, dir: -1 \| 1) => void` | 图层上移/下移 |
| `onSelect` / `onDelete` / `onToggleVisible` / `onReorder` | 现有对象回调 | 对象行行为不变 |
| `onRowContextMenu` | 现有 | 对象行右键 |
| `onClose` | 现有 | 关闭面板（同时把 `showLayerPanel` 置 false） |

### 行为

- 图层行：可见性图标、锁定图标、名称、对象数、上移/下移。
- 点击图层行 = 选中活动图层；点击对象行 = 选中对象（并同步画布）。
- 删除非空图层：先弹确认「图层内有 N 个对象，将一并删除」。
- 工具栏 6 个按钮全部可点（`disabled` 只用于「无可操作对象」等合理状态）。

---

## 2. 对象属性对话框

`ObjectPropsDialog` 的「图层：」下拉：

- 由 `disabled` 改为可用；选项 = `doc.layers`（从底到顶，显示名称）。
- 值为对象的 `layerId`；变更时通过 `onPatch({ layerId })` 提交（进入撤销）。
- 分组对象移动图层时整组移动（子对象跟随）。

---

## 3. 命令与状态

`useDocumentCommands` 新增（全部经 `applyDocument`，一步一撤销）：

| 命令 | 行为 |
|---|---|
| `createLayer()` | 追加图层（`uid()`），成为活动图层 |
| `renameLayer(id, name)` | 校验非空/长度；重名给出提示但允许 |
| `deleteLayer(id)` | Q1：连对象删除；活动图层切换按 Q5 |
| `copyLayer(id)` | Q2/Q6：复制图层 + 深拷贝对象；副本插在上方并成为活动层 |
| `setLayerVisible(id, value)` | 传播到该层对象 |
| `setLayerLocked(id, value)` | 传播到该层对象 |
| `moveLayer(id, dir)` | 调整 `layers` 顺序，并整段移动对象在 `doc.objects` 中的位置 |
| `moveObjectsToLayer(ids, layerId)` | 对象（含整组）换层 |
| `setActiveLayer(id)` | 仅改 `DocTab.activeLayerId`，不进撤销 |

**新对象归属**：所有创建路径（画布新建、粘贴、复制、导入图片）在写入前设置
`layerId = activeLayerId`；若活动图层隐藏/锁定 → 拒绝并提示（Q4=B）。

**`DocTab`** 新增字段：`activeLayerId: string | null`。

---

## 4. 菜单

`查看(V)` 菜单新增：

```
[✓] 显示图层窗体   → toggleLayerPanel()
```

绑定现有 `showLayerPanel` 偏好（`viewPreferences`，默认 true）。

---

## 5. 打印输入

打印与预览在进入 `shared/print` 前，用 `orderedVisibleObjects(doc)` 生成对象列表：

- 图层隐藏 → 对象不进入场景 / 序列号边界计算；
- 图层锁定 → 对象照常进入；
- 顺序 = 图层从底到顶 × 层内原顺序。

---

## 6. 持久化

- `MSDX_VERSION` / `DOCUMENT_MODEL_VERSION` = 3。
- `layers` 与 `layerId` 随 `LabelDoc` 序列化；旧 v2 文件经 `migrateDocument` 补默认图层。
- v3 文件在旧客户端打开时返回「模板文件版本不受支持」（R5）。

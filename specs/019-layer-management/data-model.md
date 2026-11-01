# 数据模型：真图层

**Feature**: `019-layer-management` | **Date**: 2026-11-01

## 1. Layer（新增）

存放于 `LabelDoc.layers`，顺序即叠放顺序（数组尾部 = 最上层）。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | string | 必填、文档内唯一 | 默认图层固定为 `default` |
| `name` | string | 必填、≤ 128 字符 | 面板显示名；允许重名，但保存时提示 |
| `visible` | boolean | 缺省 true | 为 false 时其下对象不可见、不打印 |
| `locked` | boolean | 缺省 false | 为 true 时其下对象不可选中/编辑，但仍可打印 |

**默认图层**：id `default`，名称「默认」，始终存在且排在列表首位（最底层），不可删除。

**数量上限**：100 个图层（与文档对象上限 10000 同量级；超出时归一化报错）。

---

## 2. LabelDoc（扩展）

```ts
interface LabelDoc {
  // ……既有字段保持不变
  /** 图层列表，顺序 = 从底到顶 */
  layers?: Layer[]
  objects: LabelObject[]
}
```

---

## 3. BaseObj（扩展）

```ts
interface BaseObj {
  // ……既有字段保持不变
  /** 所属图层 id；缺省/未知时归一化为 default */
  layerId?: string
}
```

分组（group）视为一个对象：分组本身有 `layerId`，组内子对象不单独设图层
（归一化时递归补齐为与父组相同，保证数据自洽）。

---

## 4. 文档版本与迁移

- `DOCUMENT_MODEL_VERSION`：2 → **3**；`MSDX_VERSION`：2 → **3**。
- `migrateDocument`：
  1. 若 `layers` 缺失或为空 → 写入默认图层；
  2. 若对象缺 `layerId` 或指向不存在的图层 → 归默认图层；
  3. 递归处理 group 子对象，使子对象的 `layerId` 与父组一致。
- `normalizeDocument` 校验：
  - 图层 id 非空且唯一；名称非空、长度 ≤ 128；
  - 图层数 ≤ 100；
  - 至少一个默认图层；
  - 未知 `layerId` 一律归默认（不报错，保证旧文件能开）。

---

## 5. 排序与可见性（纯函数，`shared/domain/layers.ts`）

| 函数 | 语义 |
|---|---|
| `orderedObjects(doc)` | 按图层从底到顶，每层按对象在 `doc.objects` 中的相对顺序 |
| `orderedVisibleObjects(doc)` | 在 `orderedObjects` 基础上过滤掉对象自身或图层不可见的对象 |
| `isObjectVisible(doc, object)` | `object.visible !== false` 且所属图层 `visible !== false` |
| `isObjectLocked(doc, object)` | `object.locked === true` 或所属图层 `locked === true` |
| `objectCountOfLayer(doc, layerId)` | 该层对象数（分组算 1 个） |

> 图层上移/下移时，同时移动该层对象在 `doc.objects` 中的整段位置，保持两套顺序一致（R2）。

---

## 6. 状态与生命周期

- 活动图层：`DocTab.activeLayerId`（UI 状态，不持久化进模板）。
- 删除图层：移除图层 + 删除其下对象（Q1）；一次撤销可恢复两者。
- 复制图层：复制图层 + 深拷贝对象（新 id）；副本插入原层上方并成为活动图层（Q2/Q6）。
- 删除活动图层后：按「上一个 → 下一个 → 默认」切换（Q5）。
- 图层操作与对象换层全部经 `applyDocument`，进入现有撤销栈（一步一撤销）。

---

## 7. 持久化示例（msdx v3）

```jsonc
{
  "format": "maxlabel-msdx",
  "version": 3,
  "app": "MaxLabel",
  "doc": {
    "version": 3,
    "layers": [
      { "id": "default", "name": "默认", "visible": true },
      { "id": "l_2", "name": "图层 2", "visible": false, "locked": true }
    ],
    "objects": [
      { "id": "o1", "type": "text", "layerId": "default", /* …… */ },
      { "id": "o2", "type": "barcode", "layerId": "l_2", /* …… */ }
    ]
  }
}
```

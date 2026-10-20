# Feature Specification: Object Colour Change and Colour Index Table (As-Is)

**Feature Branch**: `011-object-color-change`

**Created**: 2026-10-20

**Status**: Draft (as-is baseline; owner review pending)

**Input**: User description: "补写对象颜色变化与颜色索引表的 as-is 规格：固定/随机/内容索引/索引变量/颜色值变量/颜色索引/RGB 颜色值七种模式，整体/逐字符/区块/渐变四种粒度，颜色索引表的共享/私有来源，以及预览、位图与指令输出的一致性。以代码和测试为证据，不提出新功能。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 配置对象的动态颜色 (Priority: P1)

设计人员选中文字或条码对象，在属性页“常规 → 颜色”选择颜色模式；根据对象类型选择整体、逐字符、按区块或渐变，并在预览中看到颜色变化。

**Why this priority**: 动态颜色是标签防伪、分色和视觉编码的核心能力，也是 LabelShop 兼容功能。

**Independent Test**: 为文字对象选择“颜色索引”模式、输入 `12`、粒度“逐字符”，预览中两个字符分别使用索引 1 与 2 的颜色。

**Acceptance Scenarios**:

1. **Given** 文字对象，**When** 颜色模式选择“固定颜色”，**Then** 所有字符使用对象自身的颜色。
2. **Given** 文字对象，**When** 选择“颜色索引”并输入 `12`，**Then** 第 1 个字符取索引 1 的颜色，第 2 个取索引 2 的颜色。
3. **Given** 条码对象，**When** 选择“按区块变色”并设置 2×3，**Then** 条码按 2 行 3 列共 6 个区块取色。
4. **Given** 条码对象，**When** 选择“渐变变色”，**Then** 首个与最后一个基本颜色之间插值生成区块颜色。

---

### User Story 2 - 使用颜色索引表 (Priority: P2)

设计人员在对象属性中编辑私有索引表，或切换到文档共享索引表；索引 0–9 对应预定义十色，表为空时回退预定义表。

**Why this priority**: 颜色模式依赖索引表；共享表让同一文档的对象使用一致的配色。

**Independent Test**: 私有表为空时，索引 1 输出红色 `#FF0000`；把共享表第一位改为 `#123456` 并切换为共享来源后，索引 0 输出 `#123456`。

**Acceptance Scenarios**:

1. **Given** 默认索引表，**When** 使用索引 0–9，**Then** 依次得到黑、红、绿、蓝、黄、品红、青、灰、橙、紫。
2. **Given** 私有表为空，**When** 解析任意索引，**Then** 回退到十色预定义表。
3. **Given** 表来源为“共享”，**When** 文档的 `colorIndexTable` 有值，**Then** 使用共享表；共享表为空时回退预定义表。

---

### User Story 3 - 从数据/变量/输入取色 (Priority: P2)

设计人员选择“以数据源内容为索引”“颜色索引变量”或“颜色值变量”，颜色随标签内容或命名变量变化；“RGB 颜色值”模式直接输入逗号或竖线分隔的颜色值列表。

**Why this priority**: 可变数据打印需要按记录/内容换色，而不是固定配色。

**Independent Test**: 变量 `clr = "#123456|#654321"`，选择“颜色值变量” + 逐字符，两个字符分别得到这两个颜色。

**Acceptance Scenarios**:

1. **Given** 文字内容为 `1A`，**When** 模式为“以数据源内容为索引”且逐字符，**Then** 两个字符按索引 1 与字母索引计算取色。
2. **Given** 变量 `clr = 12`，**When** 模式为“颜色索引变量”且逐字符，**Then** 两个字符使用索引 1 与 2 的颜色。
3. **Given** 输入 `#FF0000,#00FF00` 或 `#FF0000 | #00FF00`，**When** 模式为“RGB 颜色值”，**Then** 两种分隔符得到相同的颜色列表。
4. **Given** 变量或输入为空，**When** 解析，**Then** 回退到对象原色（整体模式）而不报错。

### Edge Cases

- 对象内容为空时，“以数据源内容为索引”回退到索引 0 的颜色。
- 颜色值输入含空项（如 `,#FF0000,`）时忽略空项；全部为空则回退原色。
- 对象类型不支持所选粒度时，收敛为“整体变色”（例如矩形强制为区块）。
- 表格对象不支持颜色变化；图片只有单色/数据源图支持。
- 索引超出表长度时按取模循环。
- 随机颜色必须可复现：同一标签序号、拷贝、记录和位置必须得到同一颜色。
- 非法 RGB 值（非 `#RRGGBB`）在渐变插值中回退到两端颜色。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 颜色变化模式 MUST 包含：固定颜色、随机颜色、以数据源内容为索引、颜色索引变量、颜色值变量、颜色索引、RGB 颜色值。
  Evidence: `app/src/shared/domain/objects.ts`（`COLOR_CHANGE_MODES`）、`app/tests/unit/shared/domain/color-change.test.ts`
- **FR-002**: 颜色粒度 MUST 包含整体、逐字符、按区块、渐变；可用粒度 MUST 按对象类型收敛：
  直线/矩形/椭圆/图片仅整体；文字整体/逐字符；条码整体/区块/渐变；表格不支持。
  Evidence: `app/src/shared/domain/objects.ts`（`GRANULARITY_BY_TYPE`、`colorGranularityOptions`）、`app/tests/unit/shared/domain/color-change.test.ts`
- **FR-003**: 默认颜色索引表 MUST 为十个预定义颜色（#000000、#FF0000、#00FF00、#0000FF、#FFFF00、#FF00FF、#00FFFF、#808080、#FF8000、#8000FF），索引 0–9。
  Evidence: `app/src/shared/domain/objects.ts`（`DEFAULT_COLOR_INDEX_TABLE`）、`app/tests/unit/shared/domain/color-change.test.ts`
- **FR-004**: 颜色索引表 MUST 支持私有（对象）与共享（文档）两种来源；私有/共享表为空时 MUST 回退到预定义十色表。
  Evidence: `app/src/shared/domain/objects.ts`（`colorTableFor`）、`app/src/renderer/src/dialogs/ObjectPropsDialog.tsx`（`tableSource`、`colorIndexDraft`）
- **FR-005**: “以数据源内容为索引”MUST 对文字/条码按内容字符取色，其他对象取索引 0；内容为空时回退索引 0。
  Evidence: `app/src/shared/domain/objects.ts`（`resolveColorChangePlan` `indexByContent`）
- **FR-006**: “颜色索引变量”与“颜色值变量”MUST 从 `keyboardValues` 或当前数据库行同名列读取命名变量；缺失/空值 MUST 回退对象原色。
  Evidence: `app/src/shared/domain/objects.ts`（`resolveNamedVariable`、`indexVar`/`valueVar` 分支）
- **FR-007**: 颜色值列表 MUST 同时支持逗号与竖线分隔，忽略空项；同一列表在整体/逐字符/区块/渐变下取色一致。
  Evidence: `app/src/shared/domain/objects.ts`（`parseColorValues`、`app/tests/unit/shared/domain/color-change.test.ts`）
- **FR-008**: 颜色索引字符计算 MUST 遵循：数字 0–9 取自身；字母 A–Z/a–z 取 `|code − 'A'| mod 10`；其他字符取 `code mod 10`。
  Evidence: `app/src/shared/domain/objects.ts`（`colorIndexForChar`）、`app/tests/unit/shared/domain/color-change.test.ts`
- **FR-009**: 随机颜色 MUST 由标签序号、拷贝、记录索引与字符/区块位置派生的伪随机索引决定，预览与输出结果一致。
  Evidence: `app/src/shared/domain/objects.ts`（`pseudoRandomIndex`、`labelSeed`）
- **FR-010**: 区块/渐变 MUST 使用 `blockRows × blockCols` 个单元（行/列 1–100）；渐变 MUST 在首个与最后一个基本颜色之间插值。
  Evidence: `app/src/shared/domain/objects.ts`（`resolveColorChangePlan` 区块/渐变分支）、`app/src/shared/domain/document.ts`（`normalizeColorChange` 边界）
- **FR-011**: 取色解析 MUST 只有一个实现（`resolveColorChangePlan`），预览、位图渲染与指令输出 MUST 复用同一结果。
  Evidence: `app/src/shared/domain/objects.ts` 注释、`app/src/renderer/src/print/bitmapSource.ts`、`app/src/renderer/src/print/renderLabel.ts`、`app/src/renderer/src/print/renderLabelSvg.ts`
- **FR-012**: 图片可变颜色 MUST 仅对数据源图片或已加载的单色位图启用；嵌入/链接彩色图 MUST 不启用。
  Evidence: `app/src/shared/domain/objects.ts`（`imageSupportsVariableColor`）、`app/tests/unit/shared/domain/color-change.test.ts`
- **FR-013**: 可变颜色 MUST 仅在驱动打印（支持彩色）时可用；指令打印 MUST 通过页面位图降级表达颜色变化。
  Evidence: `app/src/shared/print/capabilities.ts`（`printerSupportsVariableColor`）、`app/src/renderer/src/features/shell/ModalHost.tsx`（`printerSupportsColor`）、`specs/003-printing-pipeline/spec.md` FR-040
- **FR-014**: 文档归一化 MUST 迁移旧模式（`variable` → `valueVar`，旧 `index` 保留）、限制私有表 ≤256 项、变量名/输入值 ≤255 字符、区块行列 1–100，非法值回退默认。
  Evidence: `app/src/shared/domain/document.ts`（`normalizeColorChange`）
- **FR-015**: 颜色索引表 MUST 随文档保存（`colorIndexTable`，≤256 项），并参与位图缓存键。
  Evidence: `app/src/shared/domain/document.ts`、`app/src/renderer/src/print/bitmapSource.ts`
- **FR-016**: 属性页 MUST 在对象类型支持且打印机支持可变颜色时显示颜色控件；图片颜色还要求 `imageColorAllowed`。
  Evidence: `app/src/renderer/src/dialogs/ObjectPropsDialog.tsx`（`colorChangeEnabled`、`patchCc`）

### Key Entities

- **ColorChangeConfig**: `mode`、`tableSource`、`privateTable`、`changeMode`、`blockRows`、`blockCols`、`variableName`、`inputValue`。
- **ColorChangePlan**: 解析结果（`solid` / `chars` / `block` / `gradient` + colors + rows/cols），供渲染与输出共用。
- **颜色索引表**: 文档级共享表（`colorIndexTable`）或对象级私有表，索引 0–9 对应预定义十色。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 七种颜色模式与四种粒度在支持的对象类型上均可选择并产生可见颜色差异。
- **SC-002**: 索引 0–9 严格对应预定义十色；空表回退预定义表。
- **SC-003**: 逗号与竖线分隔的颜色值列表产生完全相同的结果。
- **SC-004**: 同一标签/拷贝/记录/位置下，随机颜色在预览与输出中一致。
- **SC-005**: 预览、位图输出与指令输出对同一对象使用同一取色结果，无颜色漂移。
- **SC-006**: 指令打印的可变颜色通过位图降级输出，不产生错误颜色指令。

## Assumptions

- 颜色变化的展示能力取决于打印机：驱动打印支持彩色，原生指令打印通过位图回退。
- 共享颜色索引表属于文档，不随单个对象保存。
- 变量名优先匹配键盘输入变量，其次匹配当前活动数据集的同名列。
- 颜色值格式为 `#RRGGBB`；渐变插值只接受六位十六进制。

## Baseline Notes (As-Is)

- 属性页的“颜色索引表”编辑器写入 `colorIndexTable` 后立即应用到文档；是否为该编辑建立单独撤销单元待确认（TODO(待确认)）。
- 随机颜色的具体伪随机算法属于实现细节，本规格只约束“预览与输出一致、同输入可复现”（TODO(待确认)：是否需要跨版本稳定）。
- 图片“单色”判定依赖 `mono` 位图是否已加载；未加载时的颜色可用性以属性页的 `imageColorAllowed` 为准（TODO(待确认)）。

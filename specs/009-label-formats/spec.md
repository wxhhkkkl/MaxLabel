# Feature Specification: Label Formats and Page Setup (As-Is)

**Feature Branch**: `009-label-formats`

**Created**: 2026-10-20

**Status**: Draft (as-is baseline; owner review pending)

**Input**: User description: "补写标签格式库与页面设置的 as-is 规格：新建标签时按介质/品牌/类型选择标准格式，自定义标签尺寸、行列、间隔、形状、孔洞与纸张颜色，预览序号与尺寸标注，并把几何写入文档供编辑与打印共用。以现有代码和测试为证据，不提出新功能。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 从标准格式库新建标签 (Priority: P1)

操作员新建标签，先选择打印机；应用根据打印机判定卷筒标签或平张标签目录。操作员依次选择品牌、标签类型和具体格式，在预览中看到页面、标签格、序号与尺寸标注，确认后新建文档的标签宽高、行列、间隔、页面尺寸与格式码随之确定。

**Why this priority**: 这是“新建标签”的主入口；没有格式库，用户只能手工量尺寸，与 LabelShop 的操作习惯不一致。

**Independent Test**: 打开“新建标签”，选择平张目录中的默认格式 `608053`，确认后文档为 100×70 mm、2 列 4 行、行列间隔 2 mm、页面 210×297 mm。

**Acceptance Scenarios**:

1. **Given** 标签格式库已加载，**When** 打开“新建标签”，**Then** 默认选中格式码 `608053`，并显示其几何与预览。
2. **Given** 已选择平张打印机，**When** 选择卷筒打印机，**Then** 品牌/类型/格式筛选切到卷筒目录并重置到该目录的第一个格式。
3. **Given** 已选择格式，**When** 确认，**Then** 文档使用该格式的标签宽高、行列、行列间隔和页面尺寸，并记录 `formatKind: 'preset'`；格式码只用于本次选择，不写入文档。
4. **Given** 平张格式记录了 `totalLabels`，**When** 确认，**Then** 选择结果包含 `pagesPerBox`。

---

### User Story 2 - 自定义标签格式 (Priority: P1)

操作员在“新建标签”中选择“自定义”，在“标签格式设置”对话框里输入标签宽度、高度、行数、列数、行距、列距、形状、孔洞与孔洞尺寸、纸张颜色和页面宽高；预览实时更新，确认后生成自定义格式。

**Why this priority**: 标准目录之外的非标标签必须能手工定义，否则无法覆盖客户自有规格。

**Independent Test**: 创建 80×50 mm、2 列 1 行、行距 0、形状“圆角矩形”、无孔洞、页面 168×52 mm 的标签，确认后文档几何与输入一致。

**Acceptance Scenarios**:

1. **Given** 打开自定义对话框，**When** 输入宽度或高度小于 5 mm 或大于 500 mm，**Then** 点击“确定”不会生成格式（保持对话框）。
2. **Given** 形状选择“圆形”，**When** 打开预览，**Then** 预览与纸张路径使用椭圆几何。
3. **Given** 孔洞选择“无”，**When** 观察孔洞尺寸输入框，**Then** 输入框禁用且不绘制孔洞。
4. **Given** 孔洞选择“圆洞”或“矩形”，**When** 输入尺寸，**Then** 孔洞居中绘制，尺寸上限为标签短边减 0.02 mm。
5. **Given** 页面宽高留空或为 0，**When** 预览/确认，**Then** 页面尺寸按“标签网格 + 4 mm 余量”回退计算。

---

### User Story 3 - 修改自定义标签的页面属性 (Priority: P2)

操作员在已打开的自定义标签上通过“模板属性设置”调整形状、孔洞、页面尺寸与颜色；对话框回填当前文档的值，确认后编辑画布与打印输出使用同一份几何。系统预设格式的页面/标签信息只读；“标签格式设置”菜单打开的是新建标签对话框，不修改当前文档。

**Why this priority**: 标签规格经常在打样后微调，不应要求重新新建模板。

**Independent Test**: 打开一个自定义格式文档，在“模板属性设置”中把孔洞改为“圆洞”并确认；画布纸张轮廓、预览与打印页面都显示圆孔；预设格式文档中同一组字段不可编辑。

**Acceptance Scenarios**:

1. **Given** 自定义格式文档已有形状/孔洞，**When** 打开“模板属性设置”，**Then** 形状与孔洞下拉回填当前值；矩形孔洞不会被打回圆洞。
2. **Given** 文档使用系统预设格式（`formatKind = 'preset'`），**When** 打开“模板属性设置”，**Then** 页面尺寸、标签宽高、行列、形状与孔洞字段只读。
3. **Given** 自定义格式，**When** 修改页面尺寸并确认，**Then** 文档页面尺寸更新且打印布局使用新值。
4. **Given** 已打开文档，**When** 选择“标签格式设置”菜单，**Then** 打开新建标签对话框，当前文档不被改写。

---

### User Story 4 - 预览标注清晰可读 (Priority: P2)

“新建标签”和“标签格式设置”的预览在标签格中显示序号，并在上方/右侧显示尺寸标注；无论标签多小、预览视口多大，序号与标注都保持可读。

**Why this priority**: 预览是用户确认格式的唯一视觉依据；字号错误会导致“看不到序号/尺寸”的验收缺陷。

**Independent Test**: 在 20×10 mm 小标签与 100×70 mm 大标签上分别打开预览，序号与尺寸文字高度均在 9–17 px 范围。

**Acceptance Scenarios**:

1. **Given** 预览视口为 430×345 px，**When** 标签高度变化，**Then** 标注字号按渲染像素计算并限制在 9–17 px。
2. **Given** 卷筒目录，**When** 预览，**Then** 页面以竖带形式显示主标签并露出上下相邻标签的一小截。

---

### Edge Cases

- 格式库中某条名称含损坏字符（如 `?`）时，原样显示，不尝试修复。
- 未知/已删除的 `formatCode`：回退到当前类型下的第一个格式。
- 光盘类格式以 `corner = 2` 标记，按“圆形 + 中心圆孔”呈现，不新增独立形状档位。
- 由平张切换到卷筒（或反向）时，旧品牌/类型/格式必须重置，不能留下目录之外的值。
- 标签颜色只影响编辑器显示，不输出为打印底色。
- 自定义格式的行列限制为 1–100；毫米输入在失焦后显示两位小数。
- “标签格式设置 → 打印机/其他”页中存在尚未接线的占位控件（输出方式、反相、镜像、单页模式、起始位置、首选方向）；其输入不进入 `CustomLabelDraft`，属于当前实现边界。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 应用 MUST 内置一份只读标签格式库；当前库包含 275 条记录、2 个品牌、17 个类型，字段覆盖格式码、品牌、类型、介质类型、页面/标签尺寸、行列与间隔、圆角、方向、拼版、每盒数量。
  Evidence: `app/src/shared/domain/labelFormats.generated.ts`、`app/tests/unit/shared/domain/label-formats.test.ts`
- **FR-002**: 格式库 MUST 按介质类型分区：`type = 0` 为卷筒标签，`type = 1` 为平张标签；新建标签时只展示当前介质类型的品牌与格式。
  Evidence: `app/src/renderer/src/dialogs/NewLabelDialog.tsx`（`mediaTypeOfSelection`、`availableFormats`）
- **FR-003**: 介质类型 MUST 按打印机判定：签赋 LabelShop 打印机为卷筒；Windows 驱动打印机默认平张；驱动名称匹配佳博/斑马/芯烨/汉印/TSC/立象/label 等模式时按卷筒处理。
  Evidence: `app/src/renderer/src/dialogs/NewLabelDialog.tsx`（`ROLL_PRINTER_PATTERN`、`mediaTypeOfSelection`）
- **FR-004**: 新建标签 MUST 提供品牌 → 类型 → 格式三级筛选；切换品牌或类型时自动选中该组第一个格式；未知格式码回退到当前类型第一个格式或库中的默认格式。
  Evidence: `app/src/renderer/src/dialogs/NewLabelDialog.tsx`（`brands`、`categories`、`selected`、`chooseBrand`、`chooseType`）
- **FR-005**: 默认格式 MUST 为 `608053`（100×70 mm、2×4、行列间隔 2 mm、页面 210×297 mm）；库缺失默认格式时回退到第一条记录。
  Evidence: `app/src/renderer/src/dialogs/NewLabelDialog.tsx`（`INITIAL`）、`app/tests/unit/shared/domain/label-formats.test.ts`
- **FR-006**: 预览 MUST 按页面尺寸、标签网格、行列间隔与页面左边距/上边距绘制；卷筒介质 MUST 以竖带形式显示主标签及上下相邻标签片段；页面尺寸不小于单标签尺寸。
  Evidence: `app/src/renderer/src/dialogs/NewLabelDialog.tsx`（`pageW/pageH/originX/originY/viewW/viewH`）
- **FR-007**: 预览 MUST 显示标签格序号与页面/标签尺寸标注；标注字号 MUST 按渲染像素计算（比例 0.12、下限 9 px、上限 17 px），再换算回 viewBox 单位。
  Evidence: `app/src/renderer/src/dialogs/previewAnnotation.ts`、`app/src/renderer/src/dialogs/NewLabelDialog.tsx`、`app/src/renderer/src/dialogs/CustomLabelFormatDialog.tsx`
- **FR-008**: 确认预设格式时 MUST 返回 `formatKind: 'preset'`、`formatCode`、`rows`、`cols`、可选 `rowGapMm/colGapMm`、`pageWidthMm/pageHeightMm`；平张格式额外返回 `pagesPerBox = totalLabels`。文档 MUST 持久化 `formatKind`、行列/间隔、页面尺寸与 `pagesPerBox`；`formatCode` 当前不写入文档。
  Evidence: `app/src/renderer/src/dialogs/NewLabelDialog.tsx`（`confirm`、`LabelFormatSelection`）、`app/src/renderer/src/App.tsx`（`handleNewFromDialog`）、`app/src/shared/domain/document.ts`（`formatKind`）
- **FR-009**: 自定义格式 MUST 收集标签宽高、行数、列数、行距、列距、形状、孔洞、孔洞尺寸、纸张颜色、页面宽高；行列 MUST 限制在 1–100，宽高 MUST 在 5–500 mm 才允许确认。
  Evidence: `app/src/renderer/src/dialogs/CustomLabelFormatDialog.tsx`（`CustomLabelDraft`、`confirm`）
- **FR-010**: 纸张形状 MUST 支持方角矩形、圆角矩形、圆形；圆角矩形使用固定约 1 mm 圆角（显式半径仍保留以兼容旧模板）；孔洞 MUST 支持无/圆洞/矩形并居中绘制，尺寸上限为标签短边减 0.02 mm。
  Evidence: `app/src/shared/domain/paper.ts`、`app/src/renderer/src/dialogs/paperHoleFields.ts`、`app/src/renderer/src/dialogs/PaperFields.tsx`
- **FR-011**: 纸张颜色 MUST 归一为 `#RRGGBB`；非法值回退白色；颜色只用于编辑器/预览显示，不进入打印输出。
  Evidence: `app/src/shared/domain/paper.ts`（`normalizeLabelColor`）
- **FR-012**: “模板属性设置” MUST 从当前文档回填形状、孔洞（含矩形）、孔洞尺寸、页面尺寸、行列与颜色；矩形孔洞重新打开时 MUST 保持“矩形”。系统预设格式（`formatKind = 'preset'`）的页面/标签/形状/孔洞字段 MUST 只读。
  Evidence: `app/src/renderer/src/dialogs/TemplatePropsDialog.tsx`（`PaperFields`、`pageEditable/labelEditable`）、`app/src/renderer/src/dialogs/paperHoleFields.ts`
- **FR-013**: 卷筒/平张切换 MUST 重置品牌、类型与格式，避免旧筛选值落在新目录之外。
  Evidence: `app/src/renderer/src/dialogs/NewLabelDialog.tsx`（`useEffect` on `mediaType`）
- **FR-014**: 格式库 MUST 由 `LabelFormat360.fmt` 生成，运行时不手工修改；生成脚本已随 parity 资料移除，生成文件是运行时唯一事实来源。
  Evidence: `app/src/shared/domain/labelFormats.generated.ts` 文件头注释
- **FR-015**: 状态栏/文档摘要 MUST 能显示当前标签规格（宽×高与行列），供用户在编辑时确认格式。
  Evidence: `app/src/renderer/src/features/workspace/labelSpec.ts`
- **FR-016**: 文件/工具栏/右键菜单的“标签格式设置”MUST 打开新建标签对话框（创建新文档），MUST NOT 直接改写当前文档；“自定义”路径使用 `customInitial` 回填目录记录的值。
  Evidence: `app/src/renderer/src/features/commands/labelShopMenus.ts`（`setModal('new')`）、`app/src/renderer/src/features/shell/ModalHost.tsx`、`app/src/renderer/src/dialogs/NewLabelDialog.tsx`（`customInitial`）

### Key Entities *(include if feature involves data)*

- **LabelFormatRecord**: 格式码、品牌、类型/分类、介质类型、页面尺寸与边距、标签尺寸、行列与间隔、圆角、方向、拼版、每盒数量、产品名。
- **LabelFormatSelection**: 新建/修改标签后写入文档的格式结果（预设或自定义、行列、间隔、页面尺寸、格式码）。
- **CustomLabelDraft**: 自定义格式对话框的输入模型（宽高、行列、间隔、形状、孔洞、孔洞尺寸、纸张颜色、页面宽高）。
- **PaperGeometry**: 形状、圆角半径、孔洞尺寸/形状、纸张颜色；编辑器与输出共用。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 格式库加载 275 条记录，默认格式 `608053` 可被直接选中并创建标签。
- **SC-002**: 切换平张/卷筒打印机后，品牌与类型列表只包含对应介质类型的记录。
- **SC-003**: 自定义格式在 5–500 mm 宽高、1–100 行列范围内确认成功；越界输入不产生格式。
- **SC-004**: 预览序号与尺寸标注在 9–17 px 之间，大小标签均清晰可读。
- **SC-005**: 编辑器纸张轮廓、打印预览与打印页面使用同一份 `PaperGeometry` 与页面尺寸。

## Assumptions

- 格式库来源为 LabelShop `LabelFormat360.fmt`，已冻结为生成文件；本特性不提供格式库编辑入口。
- 品牌显示名对两个已知品牌使用本地化名称，其他品牌回退到库中的 `brandName`。
- 卷筒/平张判定以打印机类型与名称模式为准；无法判定时按已保存配置的 `port.type` 处理。
- “标签格式设置”的打印机/其他页是视觉占位，不属于本规格的可持久化几何。

## Baseline Notes (As-Is)

- 自定义对话框的“打印机”和“其他”页控件（输出方式、反印/镜像/单页、起始位置、首选方向）当前未进入 `CustomLabelDraft` 或文档；是否需要接线待确认（TODO(待确认)）。
- 自定义宽高越界时确认按钮静默不响应，没有错误提示；是否需要提示待确认（TODO(待确认)）。
- 光盘类格式通过 `corner = 2` 与名称中的中心孔直径推断，未进入独立形状枚举；该映射依赖名称格式（TODO(待确认)）。

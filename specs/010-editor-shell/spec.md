# Feature Specification: Editor Shell, Commands and Preferences (As-Is)

**Feature Branch**: `010-editor-shell`

**Created**: 2026-10-20

**Status**: Draft (as-is baseline; owner review pending)

**Input**: User description: "补写编辑器外壳的 as-is 规格：菜单结构、快捷键、命令可用性、工具栏分组与自定义布局、系统选项与用户偏好、视图/主题、标签页与窗口标题。以现有代码和测试为证据，不提出新功能。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 用菜单和快捷键完成编辑/打印 (Priority: P1)

操作员从启始页或打开文档后，通过菜单或快捷键执行新建、打开、保存、打印、撤销/重做、剪切/复制/粘贴、组合、锁定、缩放等命令；命令是否可用随文档、选择和数据库状态变化。

**Why this priority**: 菜单与快捷键是编辑器的主要操作入口，也是 LabelShop 兼容性的核心。

**Independent Test**: 打开一个含两个对象的文档，选中两个对象后按 Ctrl+G 组合；无选中时“组合”命令为禁用状态；在输入框中按 Ctrl+Z 不触发画布撤销。

**Acceptance Scenarios**:

1. **Given** 有活动文档，**When** 按 Ctrl+S，**Then** 保存当前文档；Ctrl+N/Ctrl+O 分别新建/打开。
2. **Given** 有活动文档，**When** 按 F1，**Then** 打开帮助；Ctrl+P 打开打印；Ctrl+F 定位记录。
3. **Given** 焦点在输入框/下拉框/可编辑区域，**When** 按 Ctrl+Z/X/C/V/A，**Then** 画布编辑命令不触发，文本控件保持原生行为。
4. **Given** 未选中对象，**When** 打开“排列”菜单，**Then** 对齐/尺寸/间距等需要多选的命令为禁用；选中两个对象后启用。
5. **Given** 选中一个组合对象，**When** 查看“取消组合”，**Then** 它可用；选中普通对象时不可用。

---

### User Story 2 - 自定义工具栏与系统选项 (Priority: P2)

操作员通过“添加或删除按钮 → 自定义”调整工具栏按钮的显示、顺序与快捷键；通过“系统选项”四页设置语言、长度单位、非打印对象行为、脚本开关、启动向导、自动旋转、工作区背景、云服务器、默认标签尺寸/排列/间隔/形状、标尺/网格、多数据库连接、默认打印方式/指令集/分辨率、表格保持尺寸等偏好。

**Why this priority**: 不同用户的常用命令与默认打印参数不同；偏好持久化决定日常效率。

**Independent Test**: 隐藏“帮助”分组、把“打印”按钮上移、为“打印”指派 Ctrl+Shift+P，保存后重启应用，工具栏布局与按键保持不变。

**Acceptance Scenarios**:

1. **Given** 默认工具栏，**When** 取消勾选某分组，**Then** 该组按钮从主工具栏消失，其他组不受影响。
2. **Given** “自定义工具栏”，**When** 上移/下移按钮或清除按键并确定，**Then** 新布局写入系统选项；取消则不改动。
3. **Given** 系统选项，**When** 切换语言或长度单位并保存，**Then** 界面语言/标尺单位立即更新并持久化。
4. **Given** 系统选项，**When** 点击“恢复默认窗体布局”，**Then** 工具栏分组与逐按钮布局恢复出厂值（保存后生效）。

---

### User Story 3 - 视图、主题与标签页 (Priority: P2)

操作员通过“查看”菜单显示/隐藏工具栏、格式栏、对齐栏、状态栏、打印窗体、图层面板、对象信息，切换蓝/黑/银/水绿主题，选择适应宽度/高度/撑满窗口/放大/缩小，并旋转标签版面；多文档以标签页呈现，可新建、关闭、重排。

**Why this priority**: 视图与多文档是长时间编辑工作的基本控件。

**Independent Test**: 隐藏状态栏和打印窗体，切换黑色主题，关闭一个标签页，重启后至少文档与标签页状态符合保存/恢复规则（视图偏好为会话级，见 Baseline Notes）。

**Acceptance Scenarios**:

1. **Given** 编辑器中，**When** 点击“查看 → 状态栏”，**Then** 状态栏显示/隐藏，其他面板不受影响。
2. **Given** 手动缩放到 150%，**When** 调整窗口大小，**Then** 手动缩放保持不变；选择“适应宽度/高度/撑满窗口”后按视口重新计算。
3. **Given** 标签版面旋转为 90°，**When** 在画布上点击/拖动，**Then** 指针坐标按旋转后的画布正确映射到对象。
4. **Given** 多个标签页，**When** 重排或关闭其中一个，**Then** 其他标签页的文档、选择与撤销历史互不影响。

---

### User Story 4 - 窗口标题与 MFC 加速键兼容 (Priority: P3)

窗口标题由应用名、模板名与版本组成；对话框标签中的 MFC 加速键标记 `&` 不显示为字面量，而是作为不可见加速键处理，`&&` 显示为一个 `&`。

**Why this priority**: 这是与 LabelShop/MFC 界面的一致性细节，影响观感但不阻断主流程。

**Independent Test**: 打开“条码属性”，标签显示“条码符号类型(码制)(B):”而不显示 `&`；窗口标题随模板名和语言更新。

**Acceptance Scenarios**:

1. **Given** 标题文本含 `(&B)`，**When** 渲染，**Then** 显示为 `(B)`，且按 Alt+B 可聚焦对应控件。
2. **Given** 标题文本含 `&&`，**When** 渲染，**Then** 显示一个 `&`。
3. **Given** 模板名变化，**When** 切换标签页，**Then** 窗口标题更新为当前模板名。

### Edge Cases

- 启始页没有文档：依赖文档的菜单/快捷键（打印、组合、定位、导出）禁用。
- 输入框、文本域、下拉框、`contenteditable` 中不触发画布快捷键（保存/新建/打开/打印/帮助除外）。
- 选中数量为 1 时，需要“两个及以上”的对齐/尺寸/组合命令禁用；间距需要三个及以上。
- 工具栏布局包含未知分组或缺失分组：未知键丢弃，缺失键按默认显示补齐。
- 数据库未配置时，数据库导航命令禁用；有活动文档才允许定位记录。
- LabelShop 内置打印机绑定时，“打印预览”菜单项禁用。
- 标签旋转为 90/270 时，画布宽高互换，标尺与适配模式按交换后的尺寸计算。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 编辑器 MUST 提供 LabelShop 兼容菜单结构：文件、编辑、查看、工具、排列、数据库、账户、云服务、选项、窗口、帮助、建议与反馈；启始页 MUST 使用独立菜单集合。
  Evidence: `app/src/renderer/src/features/commands/labelShopMenus.ts`（`editorMenus`、`startMenus`）
- **FR-002**: 菜单命令 MUST 与工具栏/快捷键调用同一组动作，命令可用性 MUST 由共享规则计算。
  Evidence: `app/src/renderer/src/features/editor/editorAvailability.ts`、`app/src/renderer/src/features/commands/useLabelShopShortcuts.ts` 文件头注释
- **FR-003**: 快捷键 MUST 至少覆盖：Ctrl+S/N/O/P/F、F1、Ctrl+Z/Y/X/C/V/A/W/G/U/L/B、Ctrl+=/-、Ctrl+Alt+0、Ctrl+R、Escape、Alt+Enter、Ctrl+E、Tab/Ctrl+T、Delete/Backspace（Shift 为剪切）、方向键移动。
  Evidence: `app/src/renderer/src/features/commands/useLabelShopShortcuts.ts`
- **FR-004**: 快捷键 MUST 在输入控件（INPUT/TEXTAREA/SELECT/contentEditable）内停用画布编辑命令；全局的保存/新建/打开/打印/帮助仍可用。
  Evidence: `app/src/renderer/src/features/commands/useLabelShopShortcuts.ts`（`isEditableTarget`）
- **FR-005**: 命令可用性 MUST 遵循：有文档才启用文档命令；≥2 个选择才能组合/对齐/尺寸；1 个组合对象才能取消组合；≥3 个选择才能间距；有数据库且切到文档后启用数据库导航。
  Evidence: `app/src/renderer/src/features/editor/editorAvailability.ts`
- **FR-006**: 主工具栏 MUST 支持 8 个分组（文件操作、复制粘贴、撤销重做、打印、对象、数据库、显示、帮助），分组可见性 MUST 归一化：未知键丢弃、缺失键默认显示。
  Evidence: `app/src/renderer/src/editor/toolbarLayout.ts`（`TOOLBAR_GROUPS`、`normalizeToolbarGroups`）
- **FR-007**: “自定义工具栏” MUST 支持逐按钮显示/隐藏、上移/下移、指派/清除按键；确定时一次性写回系统选项 `toolbarLayout`，取消不改动。
  Evidence: `app/src/renderer/src/dialogs/CustomizeToolbarDialog.tsx`、`app/src/renderer/src/editor/toolbarLayout.ts`
- **FR-008**: 系统选项 MUST 提供四个页签（常规、打印、编辑、系统），并覆盖语言、单位、非打印对象、脚本开关、启动向导、自动旋转、新建对象后打开属性、工作区背景、云服务器地址、默认标签尺寸/排列/间隔/形状、标尺/网格、多数据库连接、默认打印方式/指令集/分辨率、表格保持尺寸与恢复默认布局。
  Evidence: `app/src/renderer/src/dialogs/OptionsDialog.tsx`
- **FR-009**: 用户偏好（语言、单位、脚本开关、非打印对象行为、默认打印参数、工具栏布局等）MUST 保存并在下次启动加载；损坏或缺失字段 MUST 回退到默认值。
  Evidence: `app/src/renderer/src/dialogs/OptionsDialog.tsx`（`loadOptions`/`saveOptions`、`normalizeToolbarLayout`）、`app/src/renderer/src/features/shell/useViewPreferences.ts`
- **FR-010**: 查看菜单 MUST 控制工具栏、格式栏、对齐栏、状态栏、打印窗体、图层面板、对象信息的显示；主题 MUST 支持蓝/黑/银/水绿四套配色。
  Evidence: `app/src/renderer/src/features/commands/labelShopMenus.ts`、`app/src/renderer/src/features/shell/useViewPreferences.ts`
- **FR-011**: 缩放 MUST 支持手动、适应宽度、适应高度、撑满窗口；手动缩放 MUST 在窗口尺寸变化时保持，适配模式 MUST 按视口重新计算。
  Evidence: `app/src/renderer/src/editor/WorkArea.tsx`（`zoomMode`、`fitW/fitH`）
- **FR-012**: 标签版面 MUST 支持 0/90/180/270 度旋转，并在画布上显示旋转方向指示；旋转 90/270 时宽高互换。
  Evidence: `app/src/renderer/src/editor/WorkArea.tsx`、`app/src/renderer/src/features/commands/labelShopMenus.ts`（`setLabelRotation`）
- **FR-013**: 多文档 MUST 以标签页呈现，支持新建、选择、关闭、重排、关闭其他/全部；每个标签页独立保存文档、选择、缩放、工具、撤销历史与脏状态。
  Evidence: `app/src/renderer/src/editor/TabStrip.tsx`、`app/src/renderer/src/features/workspace/useDocumentWorkspace.ts`
- **FR-014**: 当文档绑定签赋 LabelShop 内置打印机时，“打印预览”命令 MUST 禁用。
  Evidence: `app/src/renderer/src/features/commands/labelShopMenus.ts`（`internalPrinter`）
- **FR-015**: 窗口标题 MUST 由应用名、当前模板名与版本组成，并随语言/标签页变化更新；`appTitle` 是唯一组装入口。
  Evidence: `app/src/shared/appTitle.ts`、`app/src/renderer/src/features/shell/useWindowTitle.ts`
- **FR-016**: MFC 标题文本中的单个 `&` MUST 作为加速键标记而不显示；`&&` MUST 显示为一个 `&`；`acceleratorOf` MUST 返回加速键字符。
  Evidence: `app/src/shared/mfcCaption.ts`
- **FR-017**: 样式/面板可见性与应用主题 MUST 在会话内生效；是否跨会话持久化当前由系统选项中的相关字段决定（待确认）。
  Evidence: `app/src/renderer/src/features/shell/useViewPreferences.ts`、`app/src/renderer/src/dialogs/OptionsDialog.tsx`

### Key Entities

- **AppOptions**: 语言、单位、非打印对象、脚本开关、向导、自动旋转、属性弹窗、背景色、云地址、默认标签几何、标尺/网格、多数据库连接、默认打印参数、表格保持尺寸、工具栏分组/布局。
- **ToolbarLayout**: 分组可见性 + 逐按钮顺序/可见性/按键指派。
- **DocTab**: 标签页的文档、选择、缩放模式、工具、数据集、撤销历史与修订号。
- **EditorAvailability**: 由文档/选择/数据库状态派生的命令可用性。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 上述快捷键在编辑器中逐一可用，且在输入控件中不误触发画布命令。
- **SC-002**: 需要多选的命令在 0/1/2/3 个选择时按规则启用/禁用，菜单与工具栏表现一致。
- **SC-003**: 自定义工具栏布局在保存并重启后保持；取消编辑不改动现有布局。
- **SC-004**: 系统选项四页的已接线字段全部可保存/加载，损坏配置回退默认值。
- **SC-005**: 多文档的撤销/重做、选择与缩放互不影响；关闭未保存文档时进入既有关闭确认流程。
- **SC-006**: 标签版面旋转后，指针坐标、标尺与纸张裁剪仍与对象位置一致。

## Assumptions

- 菜单/工具栏/快捷键的文案由 007-i18n 负责本地化；本规格只定义结构与行为。
- 视图面板可见性与主题当前为会话状态；跨会话偏好以系统选项中的对应字段为准。
- 快捷键集合以 LabelShop 6.37 为参照；未列出的组合键不属于本规格。
- 菜单项的启用/禁用以共享 `editorAvailability` 为唯一来源。

## Baseline Notes (As-Is)

- `useViewPreferences` 的 `show*` 与主题使用组件内 `useState`，未直接读写 localStorage；
  重启后是否保持取决于上层是否将其映射到系统选项（TODO(待确认)）。
- “启动时运行模板向导”偏好与 `appConfig.skipNewWizard` 的关系需确认（TODO(待确认)）。
- 播放/教程类菜单项（演示和体验、首页、云标签模板库、云数据库）依赖云端或外部窗口，
  其离线行为不在本规格范围。

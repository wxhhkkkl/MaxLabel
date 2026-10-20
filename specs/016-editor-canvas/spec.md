# Feature Specification: Editor Canvas Interaction (As-Is)

**Feature Branch**: `016-editor-canvas`

**Created**: 2026-10-20

**Status**: Draft (as-is baseline; owner review pending)

**Input**: User description: "补写编辑器画布交互的 as-is 规格：毫米坐标与缩放/标尺/网格/适配模式、版面旋转、对象拖拽/缩放/旋转与模型同步、多选/框选、对齐/分布/顺序/组合/锁定、剪贴板与新建对象默认值、属性页几何编辑。以现有代码和测试为证据，不提出新功能。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 在毫米画布上定位与缩放 (Priority: P1)

设计人员在以毫米为单位的画布上工作，使用标尺、网格、缩放（手动/适应宽度/适应高度/撑满窗口）和版面旋转；纸张边界与可打印区域清晰可见。

**Why this priority**: 坐标与缩放是全部编辑操作的基础。

**Independent Test**: 新建 80×60 mm 标签，选择“适应宽度”后画布横向撑满视口；手动缩放到 150% 后调整窗口，缩放保持 150%。

**Acceptance Scenarios**:

1. **Given** 画布显示，**When** 选择“适应宽度/高度/撑满窗口”，**Then** 缩放按当前视口与版面（含旋转后的宽高）重新计算。
2. **Given** 手动缩放到 150%，**When** 调整窗口大小，**Then** 缩放保持 150%，不自动改变。
3. **Given** 版面旋转为 90°，**When** 点击画布，**Then** 指针坐标按旋转逆变换映射到对象位置。
4. **Given** 开启标尺与网格，**When** 平移/缩放画布，**Then** 标尺刻度与网格随视图同步，零点与纸张原点一致。

---

### User Story 2 - 拖拽、缩放与模型同步 (Priority: P1)

设计人员拖动、缩放、旋转对象或组合；画布上的变化准确回写到文档模型，纯移动/旋转不会意外改变对象的逻辑宽高，组合内子对象保持相对位置。

**Why this priority**: 画布与文档模型不一致会直接造成打印尺寸错误。

**Independent Test**: 拖动一个 8 mm 高的条码 5 mm，模型 x 增加 5 mm、宽高不变；把组合旋转 30°，子对象相对位置保持不变。

**Acceptance Scenarios**:

1. **Given** 条形码对象，**When** 纯拖动，**Then** 模型宽高不变，仅位置更新。
2. **Given** 文字对象，**When** 拖动角手柄，**Then** 保持字形宽高比；拖动边手柄时允许拉长/压扁。
3. **Given** 矩形/椭圆/直线/表格，**When** 按住 Shift 拖动角手柄，**Then** 宽高相等（正方形/正圆/等长）。
4. **Given** 条码或使用打印机字体的文字，**When** 缩放，**Then** 宽高按 0.1 mm 步进取整，最小 0.5 mm。
5. **Given** 组合对象，**When** 移动或旋转，**Then** 组内子对象按自身局部坐标系同步，不被压扁或漂移。

---

### User Story 3 - 选择、排列与剪贴板 (Priority: P2)

设计人员多选/框选对象，执行对齐、居中、贴边、同尺寸、分布、层级调整、组合/取消组合、锁定；复制/剪切/粘贴对象，跨模板粘贴时通过系统剪贴板传递。

**Why this priority**: 批量排版与复用对象是日常效率的核心。

**Independent Test**: 选中三个对象执行“水平间距相同”，三者水平间距一致；复制对象后在新标签中粘贴，出现带新 ID 的同形对象。

**Acceptance Scenarios**:

1. **Given** 画布上拖动框选，**When** 松开鼠标，**Then** 与选择框相交的对象被选中（考虑版面旋转）。
2. **Given** 两个及以上对象，**When** 执行对齐/同尺寸，**Then** 以选择集合边界为基准排列；对齐/尺寸需要 ≥2 个对象。
3. **Given** 三个及以上对象，**When** 执行间距分布，**Then** 间距按规则均分；间距命令在少于 3 个对象时不可用。
4. **Given** 复制对象，**When** 在另一模板粘贴，**Then** 系统剪贴板中的 `maxlabel-objects` JSON 被规范化并生成新 ID；非 MaxLabel 文本被安全忽略。
5. **Given** 组合对象，**When** 取消组合，**Then** 子对象恢复为顶层对象并保留几何。

---

### User Story 4 - 新建对象与属性几何编辑 (Priority: P3)

设计人员用工具新建文字、条码、RFID、矩形、圆形、直线/斜线、表格、图片等对象；属性页中的 x/y/宽/高/旋转输入在提交时更新对象，非法输入回退原值。

**Why this priority**: 新建默认值与属性编辑决定对象初始形态和精确排版。

**Independent Test**: 用条码工具新建对象，默认码制 Code128、高度 10 mm；在属性页把宽改为 50、高改为 12 并提交，模型更新且画布重绘。

**Acceptance Scenarios**:

1. **Given** 文字工具，**When** 新建对象，**Then** 默认字体、字号、居中对齐与常量数据源生效。
2. **Given** 条码工具，**When** 新建对象，**Then** 默认 Code128、显示文字、码高 10 mm、数据 `1234567890`。
3. **Given** 表格工具且系统选项“增删行列时保持表格尺寸”开启，**When** 新建表格，**Then** 新表格 `keepSize` 默认为真。
4. **Given** 属性页几何输入，**When** 输入非数字或宽高小于 0.1，**Then** 提交时回退到原值或最小 0.1 mm。

### Edge Cases

- 版面旋转 90/270 时，选择框、标尺与适配模式使用交换后的宽高。
- 组内对象带旋转时，拖动整组不能改变子对象尺寸（按局部矩阵回写）。
- 文本/条码的画布渲染框大于模型框时，按对齐方式换算回模型框，纯移动不改变尺寸。
- 选择框可保留部分在纸张外的对象（预览）或被裁剪（输出），编辑时允许移出纸张。
- 剪贴板为空或内容不是 `maxlabel-objects`：粘贴不产生对象。
- 锁定对象不可移动/缩放，但可被选中查看属性。
- 撤销/重做按文档隔离；切换标签页不影响其他文档历史。
- 缩放下限/上限与窗口极小时，画布滚动而非产生负尺寸。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 编辑器 MUST 以毫米为唯一物理坐标；缩放 MUST 支持手动、适应宽度、适应高度、撑满窗口，默认模式为“撑满窗口”。
  Evidence: `app/src/renderer/src/editor/WorkArea.tsx`（`zoomMode`、`fitW/fitH`）、`app/src/renderer/src/features/workspace/useDocumentWorkspace.ts`
- **FR-002**: 手动缩放 MUST 在窗口尺寸变化时保持；适配模式 MUST 按视口重新计算，且考虑版面旋转后的宽高。
  Evidence: `app/src/renderer/src/editor/WorkArea.tsx`（`useEffect` on `zoomMode`、`sideways`）
- **FR-003**: 标尺与网格 MUST 随视图偏移/缩放同步；标尺零点 MUST 对应纸张原点。
  Evidence: `app/src/renderer/src/editor/WorkArea.tsx`（`Ruler`、`data-ruler-zero`、`pxPerMm`）
- **FR-004**: 版面 MUST 支持 0/90/180/270 度旋转；屏幕坐标 MUST 通过逆旋转映射到未旋转的场景坐标。
  Evidence: `app/src/renderer/src/editor/WorkArea.tsx`、`app/src/renderer/src/editor/canvasCoordinates.ts`（`clientToCanvasPoint`）
- **FR-005**: 指针事件 MUST 同时接受 `clientX/clientY` 与 `pageX/pageY`；合成事件在 client 为 0 时 MUST 使用 page 坐标并扣除滚动。
  Evidence: `app/src/renderer/src/editor/canvasCoordinates.ts`（`eventClientPoint`）
- **FR-006**: 画布操作 MUST 回写文档模型；文本/条码按对齐方式把渲染框换算回模型框，纯移动/旋转 MUST 保留模型宽高。
  Evidence: `app/src/renderer/src/features/canvas/syncFromFabric.ts`（`modelBoxOffset`、`boxScaleUnchanged`）
- **FR-007**: 组合 MUST 支持组内子对象的局部矩阵同步，移动/旋转整组不得压扁子对象。
  Evidence: `app/src/renderer/src/features/canvas/syncFromFabric.ts`（`syncWorldLeaf`）、`app/tests/unit/renderer/editor-geometry.test.ts`
- **FR-008**: 缩放规则 MUST 为：条码与打印机字体文字按 0.1 mm 步进取整、最小 0.5 mm；矩形/椭圆/直线/表格按住 Shift 时保持等宽高；文字角手柄保持字形比例，边手柄可自由拉伸。
  Evidence: `app/src/renderer/src/features/editor/resizeBehavior.ts`（`constrainFabricResize`）
- **FR-009**: 画布 MUST 支持多选与框选；框选命中 MUST 考虑版面旋转与对象在屏幕上的包围盒。
  Evidence: `app/src/renderer/src/editor/WorkArea.tsx`（`rectIntersects`、`objectClientBounds`）
- **FR-010**: 排列命令 MUST 提供对齐、居中、贴边、同尺寸、间距、层级（最前/前移/后移/最后）与锁定；对齐/同尺寸需要 ≥2 个对象，间距需要 ≥3 个。
  Evidence: `app/src/renderer/src/features/editor/operations.ts`、`app/src/renderer/src/features/editor/editorAvailability.ts`
- **FR-011**: 组合/取消组合 MUST 保留子对象几何与层级；取消组合后子对象回到顶层。
  Evidence: `app/src/renderer/src/features/editor/operations.ts`（`groupObjects`/`ungroupObjects`）
- **FR-012**: 撤销/重做 MUST 按文档隔离，并在拖动/属性编辑等连续操作中合并为一个历史单元；每个标签页独立保存历史。
  Evidence: `app/src/renderer/src/features/workspace/useDocumentHistory.ts`、`app/src/renderer/src/features/workspace/documentHistoryStack.ts`、`app/tests/unit/renderer/document-history.test.ts`
- **FR-013**: 复制/剪切 MUST 把对象写入系统剪贴板（`format: 'maxlabel-objects'`、`version: 1`）并生成本地副本；粘贴 MUST 读取并规范化为合法对象、生成新 ID，忽略非 MaxLabel 内容。
  Evidence: `app/src/renderer/src/features/editor/useDocumentCommands.ts`、`app/src/renderer/src/features/editor/objectClipboard.ts`、`app/src/shared/domain/document.ts`（`normalizeDocument`）
- **FR-014**: 新建对象 MUST 由唯一工厂提供默认值（文字、数据、条码、RFID、矩形、椭圆、表格、直线、斜线、图片）；表格 `keepSize` MUST 默认取系统选项 `tableKeepSizeOnResize`。
  Evidence: `app/src/renderer/src/features/editor/objectFactory.ts`、`app/src/renderer/src/dialogs/OptionsDialog.tsx`（`tableKeepSizeOnResize`）
- **FR-015**: 属性页几何输入 MUST 在提交时解析 x/y/宽/高/旋转；非法数字回退原值，宽/高不得小于 0.1。
  Evidence: `app/src/renderer/src/features/object-properties/useObjectGeometryDraft.ts`
- **FR-016**: 属性页页签顺序 MUST 按对象类型组织（文字：数据源/字体/文本/常规；条码：数据源/条码/字体/常规；RFID：通用/RFID/数据；图片：图片/常规；表格：表格/常规；矩形/椭圆/直线：图形/常规）。
  Evidence: `app/src/renderer/src/features/object-properties/propertyTabs.ts`
- **FR-017**: 双击对象 MUST 打开属性对话框；使用“数据”工具点击对象 MUST 打开“修改数据”入口；右键 MUST 提供对象上下文菜单（复制、删除、层级、属性等）。
  Evidence: `app/src/renderer/src/App.tsx`（`handleDoubleClick`、`handleContextMenu`、`onToolObjClick`）、`app/src/renderer/src/editor/ContextMenu.tsx`
- **FR-018**: 纸张轮廓、缩放后的纸张裁剪与对象绘制 MUST 在编辑画布上可见；纸张形状支持方角/圆角/圆形。
  Evidence: `app/src/renderer/src/editor/LabelEditor.tsx`（`paper-outline`）、`app/src/renderer/src/editor/WorkArea.tsx`

### Key Entities

- **CanvasPoint**: 客户端/页面坐标与场景坐标的转换结果。
- **EditorSelection**: 当前文档的对象选择集合、选择框与上下文菜单状态。
- **LabelObject**: 编辑器与模型共用的对象几何与属性（x/y/w/h/rotation、类型、数据源）。
- **ClipboardPayload**: `{ format: 'maxlabel-objects', version: 1, objects: LabelObject[] }`。
- **CreateObjectDefaults**: 新建对象的全局默认值（当前为表格 `keepSize`）。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 在 80×60 mm 与 100×70 mm 标签上，适配模式与手动缩放行为符合预期，窗口变化不破坏手动缩放。
- **SC-002**: 纯拖动/旋转对象后，模型宽高与拖动前一致；组合旋转后子对象相对位置误差 ≤ 0.02 mm。
- **SC-003**: 缩放规则（0.1 mm 步进、最小 0.5 mm、Shift 等宽高、文字角手柄保持比例）在对应对象类型上可验证。
- **SC-004**: 多选/框选与命令可用性符合 0/1/2/3 个选择的门槛。
- **SC-005**: 跨模板复制粘贴产生合法对象且 ID 唯一；非 MaxLabel 剪贴板内容不产生对象。
- **SC-006**: 每个标签页的撤销/重做互不影响，连续拖动只产生一个可撤销单元。

## Assumptions

- Fabric.js 是画布渲染实现，但需求只约束用户可见的几何与交互结果。
- 毫米是唯一的文档坐标单位；像素只用于屏幕渲染与命中测试。
- 版面旋转是整张标签的视图旋转，不改变文档中对象的坐标。
- 剪贴板跨进程传递使用文本 JSON；二进制/富文本剪贴板不在本规格范围。

## Baseline Notes (As-Is)

- 框选命中与多选的具体手势（橡皮筋、Shift 点击）以实现为准；本规格只约束“多选/框选可用且考虑旋转”。
- 属性页几何输入没有显式的“取消编辑”按钮；输入草稿在提交时写回（TODO(待确认)：是否需要取消/回滚语义）。
- 对象上下文菜单的完整项集合由 `labelShopMenus.contextMenu` 决定，属于 010 的菜单结构范围。
- 纸张外的对象在编辑时允许存在；输出时是否裁剪由 003 的场景规则决定。

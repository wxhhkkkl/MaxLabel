# Feature Specification: MaxLabel Desktop System Baseline (As-Is)

**Feature Branch**: `001-system-baseline`

**Created**: 2026-10-18

**Status**: Complete (as-is baseline; owner review 2026-10-19; revised 2026-10-20 after 004/005/007/008 delivery)

**Input**: User description: "以现有代码为事实来源，为 MaxLabel 桌面端编写 as-is 系统基线规格。只描述当前已实现的行为，不提出新功能；每条需求必须能追溯到源文件或现有测试；无法确认的内容标记 TODO(待确认)。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 设计并打印一张标签 (Priority: P1)

标签设计人员在桌面端新建或打开一个标签模板，添加文字、条码、图形或图片对象，
在毫米坐标画布上调整位置与尺寸，然后通过打印预览确认结果并打印到本地打印机。

**Why this priority**: 这是产品的核心价值路径；没有它，其余能力都没有使用场景。

**Independent Test**: 新建一个 80×60 mm 标签，添加一个文字对象和一个 Code128 条码，
设置内容后打开打印预览并提交打印，检查预览与打印内容一致。

**Acceptance Scenarios**:

1. **Given** 用户新建 80×60 mm 标签，**When** 添加文字与条码对象并修改内容，
   **Then** 画布按毫米坐标显示，属性面板可修改位置、尺寸、旋转与内容。
2. **Given** 标签中存在可见对象，**When** 用户打开打印预览，**Then** 预览窗口
   显示与画布一致的标签内容。
3. **Given** 已选择可用打印机，**When** 用户提交打印，**Then** 打印任务被提交，
   并可在打印日志中查看结果。
4. **Given** 标签中插入图片并添加表格对象，**When** 设置图片替换、表格行列与边框，
   **Then** 画布与打印预览呈现一致的图片和表格。

**Evidence**: `app/README.md`（编辑器与打印能力）、`app/src/renderer/src/editor/LabelEditor.tsx`、
`app/src/renderer/src/features/printing/printExecutor.ts`、`app/src/main/previewWindow.ts`

---

### User Story 2 - 批量可变数据打印 (Priority: P1)

用户为标签对象绑定数据源（常量、序列号、日期/时间、数据库、键盘输入或脚本），
按打印数量或数据库记录逐张生成标签，并控制单签拷贝数与起始标签。

**Why this priority**: 条码标签的主要业务价值是批量可变数据；单张打印不足以覆盖真实场景。

**Independent Test**: 导入一个包含 10 行记录的 CSV，绑定到文字对象，打印数量设为 10，
检查输出的 10 张标签按记录顺序取值，序列号按配置递增。

**Acceptance Scenarios**:

1. **Given** 序列号起始值为 1、步长为 1、位数为 4，**When** 连续打印 3 张，
   **Then** 输出内容依次为 0001、0002、0003。
2. **Given** 数据集有 10 行记录、打印数量为 10，**When** 执行打印，
   **Then** 每张标签使用对应记录，且打印完成后序列号状态被正确推进。
3. **Given** 脚本数据源配置了 `OnGetData` 回调，**When** 预览或打印，
   **Then** 脚本返回的内容被用于输出，且脚本不会因日志记录被重复执行。
4. **Given** 日期/时间数据源设置了格式与偏移，**When** 打印，
   **Then** 按配置的格式和偏移输出对应值。
5. **Given** 对象绑定键盘输入数据源并设置了输入顺序，**When** 打印，
   **Then** 按配置顺序提示输入并将输入值应用到对应标签。
6. **Given** 文字对象设置了大写转换与子串截取，**When** 打印，
   **Then** 输出经过格式化和截取后的文本。

**Evidence**: `app/src/shared/domain/datasource.ts`（7 类数据源）、
`app/src/shared/domain/scriptRuntime.ts`（受限脚本解释器）、
`app/src/shared/print/scene.ts` / `plan.ts`（数据解析与打印计划）、
`app/src/renderer/src/editor/dataImport.ts`

---

### User Story 3 - 多文档、保存与模板复用 (Priority: P2)

用户可以同时打开多个标签文档，每个标签页独立维护文档、选区、撤销/重做与脏状态；
可将模板保存到本地或云端，从最近模板或模板库重新打开。

**Why this priority**: 实际工作会并行处理多个标签；保存/复用决定工作是否可恢复。

**Independent Test**: 打开两个文档标签，分别修改并撤销，再保存其中一个；
关闭未保存标签时出现确认提示，重新打开后内容一致。

**Acceptance Scenarios**:

1. **Given** 两个标签页打开不同文档，**When** 在其中一个标签页执行撤销，
   **Then** 只有该文档的历史被回退，另一个标签页不受影响。
2. **Given** 同一文件已经在另一个标签页打开，**When** 尝试保存到该路径，
   **Then** 保存被拒绝并提示切换到已有标签页。
3. **Given** 云端服务已配置且用户已登录，**When** 保存模板到云端，
   **Then** 模板可从云端列表重新加载；未配置服务时使用本地离线存储。
4. **Given** 选中一个条码对象，**When** 导出条码图片并设置命名方式与前缀，
   **Then** 按规则生成 PNG/BMP 文件名并以事务方式写入所选目录。

**Evidence**: `app/src/renderer/src/features/workspace/useDocumentWorkspace.ts`、
`useDocumentHistory.ts`、`documentPersistence.ts`、`useRecentTemplates.ts`、
`app/src/main/cloudRepository.ts`、`app/src/main/sharedLibrary.ts`

---

### User Story 4 - 指令直连与多品牌打印机 (Priority: P2)

用户选择 Windows 驱动打印，或按打印机品牌/型号选择 TSPL、ZPL、CPCL 指令直连，
通过文件、TCP、串口、USB 虚拟串口或蓝牙发送；打印机属性随模板保存。

**Why this priority**: 真机兼容是产品的差异化能力；不同品牌设备需要不同的指令与端口。

**Independent Test**: 分别用 Zebra（ZPL）和 TSC（TSPL）配置各打印一张标签，
检查生成的指令/输出与打印机设置一致；对不支持的图形特性验证位图回退。

**Acceptance Scenarios**:

1. **Given** 打印机品牌为 Zebra 且选择指令打印，**When** 提交打印，
   **Then** 使用 ZPL 生成指令并发送到所选端口。
2. **Given** 标签包含原生指令无法等价表达的对象旋转或椭圆，**When** 提交打印，
   **Then** 该页回退为单色位图；位图未准备好时阻止发送并提示。
3. **Given** 打印机设置已修改（速度、浓度、介质类型、顶部偏移等），
   **When** 保存模板并重新打开，**Then** 设置被恢复。

**Evidence**: `app/src/shared/print/tspl.ts`、`zpl.ts`、`cpcl.ts`、`capabilities.ts`、
`app/src/main/printing/commandTransport.ts`、`app/src/main/ipc/registerPrintIpc.ts`、
`app/src/renderer/src/dialogs/PrinterSettings.tsx`、`app/src/shared/domain/printer.ts`

---

### User Story 5 - 授权激活与离线可用 (Priority: P2)

用户使用授权密钥在线激活，授权绑定机器码；启动时在线复查，失败时保留本地缓存，
且授权状态不影响离线编辑与本地保存。

**Why this priority**: 授权是商业分发的前提，但不能因为网络或服务不可用而阻断用户工作。

**Independent Test**: 在没有有效授权或服务器不可达的情况下启动应用，
仍可新建、编辑并保存本地模板；输入有效密钥后激活成功并绑定当前机器。

**Acceptance Scenarios**:

1. **Given** 用户没有有效授权，**When** 启动并编辑本地模板，
   **Then** 编辑与保存不被阻断。
2. **Given** 有效密钥首次激活，**When** 在机器 A 上激活成功，
   **Then** 同一密钥在另一机器码上不能再次绑定。
3. **Given** 本地存在授权缓存，**When** 启动时服务器不可达，
   **Then** 保留缓存状态，不因复查失败清除本地授权。

**Evidence**: `app/src/main/license.ts`、`app/src/renderer/src/features/shell/useLicenseStartup.ts`、
`app/src/main/secureJsonStore.ts`、`app/src/main/connectionSecrets.ts`

---

### Edge Cases

- 条码内容不符合所选码制的字符集时，界面或打印流程应拒绝并给出提示，
  不得输出不可扫描的条码。Evidence: `app/src/shared/domain/barcodeCharset.ts`
- 数据库连接失败或查询被取消时，不得把过期结果导入当前文档。
  Evidence: `app/src/renderer/src/features/data/useDataManagement.ts`
- 批量打印中途取消或端口失败时，打印日志应记录已发送数量与
  `partial`/`failed`/`unknown` 状态。Evidence: `app/src/shared/print/logSchema.ts`
- 关闭包含未保存修改的标签页时，必须要求确认；等待确认期间文档被修改时，
  不得丢失新修改。Evidence: `app/src/renderer/src/features/workspace/documentPersistence.ts`
- 脚本包含被禁止的能力（`eval`、`require`、网络/存储访问等）时，
  必须拒绝执行。Evidence: `app/src/shared/domain/scriptRuntime.ts`
- 图片或模板文件路径越出用户选择的范围时，主进程必须拒绝读取/写入。
  Evidence: `app/src/main/ipc/pathAccess.ts`

## Requirements *(mandatory)*

### Functional Requirements

#### 产品与平台

- **FR-001**: Desktop application MUST run on Windows x64 (primary) and support multiple
  document tabs, each with an independent document, selection, history and dirty state.
  macOS/Linux builds and transports are specified in `005-cross-platform`.
  Evidence: `app/package.json`（electron-builder `win.x64`）、`features/workspace/useDocumentWorkspace.ts`、
  `specs/005-cross-platform/spec.md`
- **FR-002**: The editor MUST use millimetres as the physical coordinate system and
  provide zoom, grid and horizontal/vertical rulers.
  Evidence: `app/src/shared/domain/units.ts`、`app/src/renderer/src/editor/LabelEditor.tsx`
- **FR-003**: The product MUST be a single complete edition; license validity MUST NOT
  select a feature subset.
  Evidence: `app/README.md`、`app/src/main/license.ts`

#### 编辑器与对象

- **FR-010**: Users MUST be able to create and edit text, barcode, RFID, rectangle,
  line, ellipse, table, image and group objects.
  Evidence: `app/src/shared/domain/objects.ts`
- **FR-011**: Users MUST be able to drag, resize, rotate, multi-select, align, lock and
  group objects, with per-document undo/redo.
  Evidence: `features/editor/operations.ts`、`useEditorTransformCommands.ts`、`useDocumentHistory.ts`
- **FR-012**: The property panel MUST expose content, font, size, colour, position in mm,
  rotation, case formatting and substring extraction.
  Evidence: `app/src/renderer/src/editor/PropertyPanel.tsx`、`dialogs/ObjectPropsDialog.tsx`
- **FR-013**: Users MUST be able to configure label width/height, 0/90/180/270 orientation,
  shape, holes, layout rows/columns, gaps and print order.
  Evidence: `app/src/shared/domain/paper.ts`、`dialogs/NewLabelDialog.tsx`、`dialogs/CustomLabelFormatDialog.tsx`
- **FR-014**: The editor MUST support the following symbologies: Code128, EAN-13, EAN-8,
  UPC-A, UPC-E, Code39, Code93, Codabar, Interleaved2of5, ITF-14, Matrix25,
  GS1 DataBar, QR, DataMatrix, PDF417 and Hanxin.
  Evidence: `app/src/renderer/src/editor/barcodeTypes.ts`、`barcode.ts`
- **FR-015**: Users MUST be able to insert/replace images and configure table rows,
  columns, border width and colour.
  Evidence: `app/src/shared/domain/objects.ts`、`dialogs/ObjectPropsDialog.tsx`

#### 数据源

- **FR-020**: Objects MUST support seven data source kinds: constant, serial, date,
  time, database field, keyboard input and script.
  Evidence: `app/src/shared/domain/datasource.ts`
- **FR-021**: Serial sources MUST support prefix, start value, step, padding, repeat and
  custom character set, and MUST advance/write back after printing.
  Evidence: `app/src/shared/domain/datasource.ts`、`features/printing/printJob.ts`
- **FR-022**: Date/time sources MUST support configurable formats and offsets.
  Evidence: `app/src/shared/domain/datasource.ts`
- **FR-023**: Database sources MUST support CSV, tab-separated text, Excel, ODBC/SQL
  Server, MySQL and SQLite, with connection testing, query import and pre-print refresh.
  Evidence: `app/src/renderer/src/editor/dataImport.ts`、`app/src/main/db.ts`、`dialogs/DataPanel.tsx`
- **FR-024**: Keyboard sources MUST support per-label prompts and configurable input order.
  Evidence: `app/src/renderer/src/dialogs/KeyInputOrderDialog.tsx`、`shared/domain/datasource.ts`
- **FR-025**: Script sources MUST provide the LabelShop-compatible lifecycle hooks
  (`OnBeginPrint`, `OnGetData`, `OnBeginLabel`, `OnEndLabel`, `OnEndPrint`) and built-in
  variables, executed by a restricted interpreter that cannot run arbitrary JavaScript
  or access host/network/storage APIs.
  Evidence: `app/src/shared/domain/scriptRuntime.ts`、`app/src/shared/domain/datasource.ts`
- **FR-026**: Object-level formatting (uppercase/lowercase/title case) and substring
  extraction MUST apply to the printed output.
  Evidence: `app/src/shared/domain/datasource.ts`、`shared/print/scene.ts`

#### 打印

- **FR-030**: All print paths MUST resolve `LabelDoc + DataCtx` into a
  `ResolvedPrintScene` and `PrintPlan` before producing output; protocol adapters MUST NOT
  re-resolve data sources.
  Evidence: `app/src/shared/print/scene.ts`、`plan.ts`、
  `specs/003-printing-pipeline/plan.md`、`specs/003-printing-pipeline/contracts/scene-plan.md`
- **FR-031**: The system MUST support printing through the Windows printer driver.
  Evidence: `app/src/main/ipc/registerPrintIpc.ts`、`features/printing/printExecutor.ts`
- **FR-032**: The system MUST support native TSPL, ZPL and CPCL command generation with
  DPI conversion for 203/300/600 dpi.
  Evidence: `app/src/shared/print/tspl.ts`、`zpl.ts`、`cpcl.ts`、`geometry.ts`
- **FR-033**: Native command output MUST support file, TCP, COM, USB virtual serial,
  Bluetooth SPP and Windows driver ports.
  Evidence: `app/src/main/printing/commandTransport.ts`、`app/src/shared/domain/printer.ts`
- **FR-034**: Printer settings (speed, density, media type, offsets, media handling,
  feed behaviour) MUST be stored with the template.
  Evidence: `app/src/renderer/src/dialogs/PrinterSettings.tsx`、`shared/domain/printer.ts`
- **FR-035**: Batch printing MUST support print count × copies-per-label, database row
  advancement and a start-label position.
  Evidence: `app/src/shared/print/plan.ts`、`features/printing/printJob.ts`
- **FR-036**: When native protocols cannot express an object's rotation, complex text
  styling, fill/colour, ellipse or unknown barcode, the page MUST fall back to a
  pre-rendered monochrome bitmap; printing MUST be blocked if the bitmap is not ready.
  Evidence: `app/src/shared/print/capabilities.ts`、`compat.ts`、`bitmap.ts`
- **FR-037**: RFID objects MUST support writing EPC/USER/TID data and optional locking.
  Evidence: `app/src/shared/domain/objects.ts`、`app/src/shared/print/tspl.ts`、`zpl.ts`
- **FR-038**: Test printing MUST print one label without writing a log entry or advancing
  serial-number state.
  Evidence: `app/src/renderer/src/features/printing/printJob.ts`
- **FR-039**: The system MUST write a local print log (JSONL) using the resolved data
  snapshot, including status and sent count for partial/unknown outcomes.
  Evidence: `app/src/shared/print/logSchema.ts`、`app/src/main/ipc/registerLogIpc.ts`
- **FR-040**: The system MUST provide a print preview window and support cancelling a
  print job during batch transmission.
  Evidence: `app/src/main/previewWindow.ts`、`features/printing/usePrintWorkflow.ts`

#### 模板、导入与云服务

- **FR-050**: Users MUST be able to save/open local JSON templates containing objects,
  printer configuration, datasets and database connections, and import `.lsdx` files.
  Evidence: `app/src/renderer/src/io/lsdxImport.ts`、`app/src/main/ipc/registerTemplateIpc.ts`
- **FR-051**: The start page MUST list recent templates and allow reopening them.
  Evidence: `app/src/renderer/src/features/workspace/useRecentTemplates.ts`、`pages/StartPage.tsx`
- **FR-052**: When a cloud server is configured, users MUST be able to save/list/load/delete
  cloud templates; without a configured server, local offline storage MUST be used.
  Evidence: `app/src/main/cloudRepository.ts`、`cloud.ts`、`cloudService.ts`
- **FR-053**: The system MUST support a shared template library (publish/load/delete).
  Evidence: `app/src/main/sharedLibrary.ts`
- **FR-054**: Users MUST be able to export barcode images as PNG/BMP with serial, content
  or content+serial naming and an optional prefix.
  Evidence: `app/src/main/barcodeExport.ts`、`features/exporting/barcodeExport.ts`

#### 授权、更新与安全

- **FR-060**: The system MUST support online license activation and re-check using a
  license key and machine ID, caching the result locally; offline editing MUST NOT be
  blocked by an invalid or unreachable license server.
  Evidence: `app/src/main/license.ts`、`features/shell/useLicenseStartup.ts`
- **FR-061**: The system MUST check for updates through the configured cloud server's
  version endpoint.
  Evidence: `app/src/main/updater.ts`（`GET <base>/api/version`）
- **FR-070**: All privileged renderer→main operations MUST go through the registered IPC
  channels and be validated (payload, file size, extension, port and database config).
  Evidence: `app/src/shared/ipcContract.ts`、`app/src/main/ipc/validation.ts`、`senderGuard.ts`
- **FR-071**: The renderer MUST NOT read or overwrite arbitrary local files by path string;
  file access MUST be limited to paths produced by system dialogs.
  Evidence: `app/src/main/ipc/pathAccess.ts`、`app/src/preload/index.ts`
- **FR-072**: Database passwords, cloud tokens and other secrets MUST be stored with
  Electron `safeStorage` and atomic JSON persistence; template files MUST NOT contain
  database passwords.
  Evidence: `app/src/main/secureJsonStore.ts`、`connectionSecrets.ts`、`cloudCredentials.ts`
- **FR-073**: Document saving MUST be serialized per path, reject saving to a path already
  open in another tab, and preserve changes made while a close-confirmation dialog is open.
  Evidence: `app/src/renderer/src/features/workspace/documentPersistence.ts`

### Key Entities

- **LabelDoc**: 标签文档，包含尺寸、方向、对象集合、全局脚本、数据集与打印机配置。
- **LabelObject**: 文字、条码、RFID、矩形、直线、椭圆、表格、图片或组合对象。
- **DataSource**: 常量、序列号、日期、时间、数据库、键盘输入或脚本数据源。
- **PrinterConfig**: 打印机名称、指令集、端口、DPI、速度、浓度、介质与偏移设置。
- **ResolvedPrintScene / PrintPlan**: 已解析的打印场景与可执行打印计划（数量、拷贝、
  拼版槽位、起始标签）。
- **Template**: 可保存/打开的本地或云端模板，包含文档、打印机配置、数据集与连接。
- **LicenseState**: 授权密钥、机器码、有效期、激活状态与本地缓存。
- **PrintLog**: 打印日志条目，含已解析数据快照、状态、数量与发送结果。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 16 种条码码制可在编辑器中创建并输出（一维 12 种 + 二维 4 种）。
- **SC-002**: 7 类数据源均可在打印时解析，序列号按配置逐张推进。
- **SC-003**: 3 套原生指令（TSPL/ZPL/CPCL）与 Windows 驱动打印均可完成一张标签的输出。
- **SC-004**: 用户可在同一窗口打开多个文档，撤销/重做互不影响，关闭未保存文档时收到确认。
- **SC-005**: 批量打印 10 条数据库记录时，10 张标签按记录顺序输出且序列号连续。
- **SC-006**: 在授权服务器不可达的情况下，用户仍可新建、编辑并保存本地模板。
- **SC-007**: 本规格中的每条 FR 都有对应的代码或测试证据；无法确认的内容在
  Baseline Notes 中列出，而不是被猜测填充。

## Assumptions

- 目标平台以 Windows 10/11 x64 为主；跨平台构建与传输（macOS/Linux、CUPS/USB/serial）
  由 `005-cross-platform` 定义，本基线不重复其范围。
  Evidence: `app/package.json`、`specs/005-cross-platform/spec.md`
- 产品只有一个完整版本；授权只判断有效性，不控制功能集合。
- 用户拥有可用的本地打印机，或已配置 TCP/串口/USB/蓝牙端口。
- 云服务是可选依赖；未配置服务器时，云模板使用本地离线存储。
- 开发环境使用 Node.js ≥ 22.12.0（`app/package.json` 的 `engines`）。
- 目标用户：通用中小企业（owner 确认，2026-10-19）；典型标签尺寸与批量按客户模板
  混合，不限定单一规格。
- 中英双语界面由 `007-i18n` 定义并已实现；本基线只描述与界面语言无关的文档与打印行为。
  Evidence: `specs/007-i18n/spec.md`、`app/src/shared/i18n/`
- 测试架构由 002 重建（Vitest + Playwright）；旧 `parity:app/scripts` 套件已于
  2026-10-18 移除。当前证据以 `app/tests/` 为准，历史证据仍可追溯到 `parity`
  （`546f151`）。

## Baseline Notes (As-Is)

以下为编写本基线时确认的**已知缺口或待确认项**，不是需求，也不得被当作已实现：

- 中国邮政码：`bwip-js` 未内置，当前未实现；可能走打印机内建条码。
  Evidence: `app/README.md`
- 未收录品牌的指令集为尽力而为（依次尝试 TSPL→ZPL→CPCL），不保证 100% 正确。
  Evidence: `app/src/shared/print/compat.ts`
- 客户端已定义云数据库读取接口（`/api/cloud/databases*`），旧服务端未实现对应路由；
  是否保留该能力待确认。 Evidence: `app/src/main/cloudRepository.ts`
- 客户端更新检查依赖 `<base>/api/version`，旧 FastAPI 服务端未实现该路由；
  是否保留/补齐待确认。 Evidence: `app/src/main/updater.ts`
- 打印指令对复杂文字、颜色、椭圆等只能回退位图；这不是缺陷，是当前设计边界。
  Evidence: `app/src/shared/print/capabilities.ts`
- 没有定义产品级性能 SLO；代码中的硬限制（脚本 256 KB/1 MB、逻辑标签 100000、
  物理标签 1000000 等）是当前唯一约束。Evidence: `app/src/shared/print/limits.ts`,
  `scriptRuntime.ts`, `plan.ts`

### 已关闭的基线缺口（2026-10-20 修订）

以下条目在编写本基线时尚未实现，现已由后续特性交付，不再属于“未实现”项：

- ESC/POS 指令生成：由 `004-escpos` 交付。
- 中英双语界面：由 `007-i18n` 交付。
- 电子称串口重量采集：由 `008-electronic-scale` 交付；正式配置入口在数据源编辑器，
  菜单「电子称」打开的旧占位对话框不属于该特性（TODO(待确认)：合并或移除该菜单项）。
- macOS/Linux 构建与传输：由 `005-cross-platform` 交付（真机手工验证仍待补）。

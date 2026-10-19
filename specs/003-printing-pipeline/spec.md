# Feature Specification: Printing Pipeline and Devices (As-Is)

**Feature Branch**: `003-printing-pipeline`

**Created**: 2026-10-18

**Status**: Documentation and automated verification complete; TSPL/USB/driver/settings/cancel verified on the Zenpert 4T530; TCP disconnect, RFID, ZPL/CPCL and owner sign-off pending (2026-10-19)

**Input**: User description: "补全打印流水线与设备的 as-is 规格：统一场景/计划、Windows 驱动打印、TSPL/ZPL/CPCL 指令直连、端口传输、能力降级、批量与序列号、预览/日志/取消、打印机配置与目录。以现有代码和测试为证据，不提出新功能。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 通过 Windows 驱动打印标签 (Priority: P1)

用户选择 Windows 打印机，设置打印数量与单签拷贝，提交后系统把展开后的页面作为一个系统打印任务提交，并记录结果。

**Why this priority**: 这是普通办公/家用打印机用户的主路径，也是与指令直连并列的核心输出方式。

**Independent Test**: 用一张 60×40 mm 标签、数量 3、单签拷贝 2 执行驱动打印，确认提交 3 个页面（每页 copies=2），打印日志记录 `submitted`，序列号按 3 张推进。

**Acceptance Scenarios**:

1. **Given** 一份含文字/条码的标签文档，**When** 选择驱动端口并打印，**Then** 系统按 `ResolvedPrintScene` 渲染页面并一次性提交驱动任务。
2. **Given** 打印数量 3、单签拷贝 2，**When** 打印成功，**Then** 日志记录 `physicalCount=6`、`sentCount=6`，序列号只推进 3。
3. **Given** 驱动打印返回失败，**When** 执行结束，**Then** 日志记录失败状态，且不推进序列号。
4. **Given** 测试打印，**When** 提交，**Then** 只输出一张标签、不写日志、不推进序列号。

**Evidence**: `app/src/renderer/src/features/printing/printExecutor.ts`、`printJob.ts`、
`tests/integration/renderer/print-executor.test.ts`

---

### User Story 2 - 指令直连 TSPL/ZPL/CPCL (Priority: P1)

用户选择打印机品牌/型号或指令集，通过文件、TCP、COM、USB、蓝牙或 LPT 发送原生指令；系统按 DPI 和编码生成对应协议的字节流。

**Why this priority**: 条码标签的实际生产设备以指令直连为主；协议输出正确性直接决定标签是否可扫。

**Independent Test**: 分别用 TSPL、ZPL、CPCL 打印同一份 60×40 mm 文档，检查协议头、条码/文本/图形指令、DPI 换算与结束指令；用 TCP 本机回环和文件输出验证传输。

**Acceptance Scenarios**:

1. **Given** 203/300/600 dpi 打印机，**When** 生成原生指令，**Then** 物理标签尺寸不变，点阵尺寸按 DPI 换算。
2. **Given** 25 张标签、TCP 端口，**When** 打印，**Then** 按 24 页一批分成两批发送；第一批成功、第二批失败时日志为 `partial` 且只回写已确认的序列号。
3. **Given** 选择文件端口，**When** 打印，**Then** 指令合并为一个文件保存，不按批拆成多个文件。
4. **Given** UTF-8 或 GBK 编码，**When** 发送中文内容，**Then** 按所选编码输出字节流。
5. **Given** 传输层返回 `unknown`（连接中断、USB 未确认），**When** 任务结束，**Then** 日志记录 `unknown`，不把未确认的标签计为已发送。

**Evidence**: `app/src/shared/print/engine.ts`、`tspl.ts`、`zpl.ts`、`cpcl.ts`、
`geometry.ts`、`app/src/main/printing/commandTransport.ts`、
`tests/unit/shared/print/tspl.test.ts`、`zpl.test.ts`、`cpcl.test.ts`、
`tests/integration/main/printing-transport.test.ts`

---

### User Story 3 - 批量可变数据与打印计划 (Priority: P1)

用户按数据库记录、打印数量、单签拷贝、起始标签和拼版布局生成打印计划；序列号按已确认输出推进并回写。

**Why this priority**: 批量可变数据是产品的核心业务价值；计划错误会造成错标、漏标或编号重复。

**Independent Test**: 4 条数据库记录、每条拷贝数不同、2 枚/页，检查页/槽位/记录索引/物理张数与序列号推进；起始标签留空位；查重后保持原始行号。

**Acceptance Scenarios**:

1. **Given** 数据库记录与 `copyField`，**When** 构建可执行计划，**Then** 页、槽位、记录索引和物理张数正确，拷贝不推进序列号。
2. **Given** `startSlot=2`，**When** 打印，**Then** 首页前两个槽位留空并产生提示。
3. **Given** 查重开启，**When** 构建计划，**Then** 重复记录被去除且保留首次出现的原始行号。
4. **Given** 数据库为空，**When** 打印，**Then** 阻止提交并提示没有可打印记录，不回退为常量打印。
5. **Given** 打印数量/拷贝超过上限，**When** 构建计划，**Then** 明确拒绝并给出限制值。

**Evidence**: `app/src/shared/print/plan.ts`、`layout.ts`、`limits.ts`、
`tests/unit/shared/print/plan.test.ts`、`tests/integration/renderer/print-executor.test.ts`

---

### User Story 4 - 原生能力不足时降级为位图 (Priority: P2)

当 TSPL/ZPL/CPCL 无法等价表达对象旋转、复杂文字样式、填充/颜色、椭圆或未知条码时，整页回退为单色位图；位图未准备好时阻止发送。

**Why this priority**: 宁可阻止任务，也不能静默输出缺少内容的标签。

**Independent Test**: 构造含旋转/椭圆/动态颜色的场景，检查能力判定需要栅格化；生成原生指令时输出页位图；位图缺失时发送被阻止。

**Acceptance Scenarios**:

1. **Given** 动态颜色或高级条码选项，**When** 调用能力判定，**Then** 要求整页栅格化。
2. **Given** 原生协议无法表达的旋转/椭圆，**When** 打印，**Then** 页位图替代原生图元；位图未就绪时任务失败而不是部分输出。
3. **Given** RFID 对象，**When** 指令打印，**Then** 保留 RFID 原生写入/锁定命令。
4. **Given** 打印机内建字体或中文文本，**When** 指令打印，**Then** 分别输出内建字体指令或整页位图。

**Evidence**: `app/src/shared/print/capabilities.ts`、`compat.ts`、`bitmap.ts`、
`tests/unit/shared/print/scene.test.ts`、`device-output.test.ts`、
`tests/e2e/render-harness.spec.ts`

---

### User Story 5 - 预览、测试打印、日志与取消 (Priority: P2)

用户可以在提交前打开打印预览；打印过程可取消；系统把已解析数据快照、状态和已发送数量写入本地 JSONL 日志。

**Why this priority**: 预览与日志是发现错标和追责的主要手段；取消/部分发送必须有明确语义。

**Independent Test**: 打开预览窗口检查页数与图像；执行测试打印检查不写日志/不推进序列号；模拟批次取消与部分发送，检查日志状态。

**Acceptance Scenarios**:

1. **Given** 一份标签文档，**When** 打开打印预览，**Then** 预览窗口显示页数、缩放与可关闭，内容来自同一 `ResolvedPrintScene`。
2. **Given** 测试打印，**When** 提交，**Then** 只输出一张，不写日志、不推进序列号。
3. **Given** 批次发送中取消，**When** 任务结束，**Then** 状态为 `canceled`，已确认的序列号按已发送数量回写，后续任务不受影响。
4. **Given** 默认日志位置，**When** 打印完成，**Then** JSONL 条目包含时间、模式、数量、拷贝、计划/已发送张数、状态、打印机与解析数据快照。

**Evidence**: `app/src/main/previewWindow.ts`、`app/src/renderer/src/features/printing/usePrintWorkflow.ts`、
`printPreviewService.ts`、`printJobJournal.ts`、`app/src/shared/print/logSchema.ts`、
`tests/integration/renderer/print-executor.test.ts`、`tests/e2e/print-preview.spec.ts`

---

### User Story 6 - 打印机配置与设备目录 (Priority: P3)

用户配置打印机品牌/型号、指令集、DPI、速度、浓度、介质、偏移、端口等；系统按品牌推荐指令集，未收录品牌按尽力而为策略处理。

**Why this priority**: 设备差异必须落在配置/能力档案中，而不是散落在业务逻辑里。

**Independent Test**: 保存并重新打开模板检查打印机配置；按品牌选择检查推荐指令集；校验端口参数与未知字段过滤。

**Acceptance Scenarios**:

1. **Given** 修改速度/浓度/介质/偏移/回退，**When** 保存模板并重新打开，**Then** 配置完整恢复。
2. **Given** Zebra/TSC/佳博等品牌，**When** 选择打印机，**Then** 推荐 ZPL/TSPL 等对应指令集。
3. **Given** 未收录品牌，**When** 选择，**Then** 按 TSPL→ZPL→CPCL 的尽力策略处理并提示不保证 100% 正确。
4. **Given** 端口参数，**When** 校验，**Then** 未知字段被丢弃，非法数据位/停止位/流控制/TCP 地址/端口被拒绝。

**Evidence**: `app/src/shared/domain/printer.ts`、`printerCatalog.generated.ts`、
`app/src/renderer/src/dialogs/PrinterSettings.tsx`、
`tests/unit/shared/domain/printer-catalog.test.ts`、`tests/contracts/ipc-contract.test.ts`

### Edge Cases

- 25 张标签超过单批 24 页时分批发送；后批失败只记录前批已确认数量。
- TCP 连接在写入后关闭时状态为 `unknown`，不能假定打印成功。
- USB 队列返回不完整/异常完成标记时状态为 `unknown`，不推进序列号。
- 脚本生命周期钩子失败时阻止驱动/指令/预览提交。
- 驱动页面数据超过大小上限、指令文件超过 64 MB 或片段超过 100000 时拒绝任务。
- 位图未准备好时阻止发送，避免“部分打印但用户以为完整”。
- 未知端口类型或缺少主机/串口/USB 设备时明确失败。
- 超大文字样式在分配画布前被拒绝。

## Requirements *(mandatory)*

### Functional Requirements

#### 统一场景与计划

- **FR-001**: All print paths MUST resolve `LabelDoc + DataCtx` into `ResolvedPrintScene` and `PrintPlan` before producing output; protocol adapters MUST NOT re-resolve data sources.
- **FR-002**: The scene MUST expand groups, filter hidden objects, exclude `suppressPrint` by default, and let preview keep partially/fully outside objects while native output keeps only fully-inside objects.
- **FR-003**: The scene snapshot MUST retain only the current database row and column metadata, not the full dataset.
- **FR-004**: `PrintPlan` MUST be the single source of truth for requested count, copies, record start, slots, dedupe, physical/logical counts and serial advancement.
- **FR-005**: Imposition MUST honor rows/cols, row/column gaps, print order, start position, page offsets and label print direction.
- **FR-006**: Auto-rotation and 180° output rotation MUST be applied to the shared scene while preserving the physical sheet size.

#### 驱动打印

- **FR-010**: The system MUST render each executable plan page to a raster data URL and submit the expanded pages as one Windows print job.
- **FR-011**: Driver printing MUST use the shared page size/orientation and reject payloads above `MAX_DRIVER_DATA_BYTES`.
- **FR-012**: Test printing MUST output one label without writing a print log or advancing serial numbers.

#### 原生指令

- **FR-020**: The system MUST generate TSPL, ZPL and CPCL commands with 203/300/600 dpi conversion and protocol-specific barcode/text/shape commands.
- **FR-021**: Native output MUST support UTF-8 and GBK (GB18030) encodings.
- **FR-022**: Native command payloads MUST consist of text/binary segments; TCP/USB/COM/Bluetooth outputs MUST be sent in batches of at most 24 pages.
- **FR-023**: Preamble and postamble MUST be emitted once per job, not once per batch.
- **FR-024**: File output MUST combine all batches into one saved command file.

#### 端口与传输

- **FR-030**: The system MUST support driver, file, TCP, COM, USB, Bluetooth, LPT and cloudbox ports.
- **FR-031**: Port configuration MUST be allowlisted and validated (unknown fields dropped; data bits/parity/stop bits/flow control/TCP address/port/LPT name checked).
- **FR-032**: USB completion MUST distinguish confirmed, incomplete and unknown queue outcomes; TCP disconnect after write MUST be `unknown`; pre-aborted sends MUST be `canceled`.
- **FR-033**: Serial/LPT transports MUST fail clearly on unsupported platforms or missing configuration.

#### 能力降级

- **FR-040**: Unsupported rotation, complex text styling, fill/colour, ellipse or unknown barcode MUST force page rasterization; sending MUST be blocked if the bitmap is not ready.
- **FR-041**: RFID objects MUST retain native EPC/USER/TID write and lock commands.
- **FR-042**: Built-in printer fonts MUST use native font commands; Chinese text without a built-in font MUST be rasterized.
- **FR-043**: Oversized text/barcode styling MUST be rejected before allocating the output canvas.

#### 批量、序列号与数据完整性

- **FR-050**: Serial numbers MUST advance only for confirmed output and MUST write back to the document/selected dataset.
- **FR-051**: Copies MUST not advance serial numbers; repeat/basis semantics MUST follow the configured serial source.
- **FR-052**: An empty database MUST block printing instead of falling back to constant output.
- **FR-053**: Logical labels, copies and physical labels MUST respect 100000 / 99999 / 1000000 limits.
- **FR-054**: Pre-filtered/duplicate-removed records MUST preserve their original row indices.

#### 预览、日志与取消

- **FR-060**: Print preview MUST render from the same resolved scene and show page count, zoom and close controls.
- **FR-061**: Print logs MUST use the resolved data snapshot and record time, mode, counts, status, sent count, test flag, printer and snapshot.
- **FR-062**: Cancellation MUST abort in-flight transmission, mark `canceled`, and must not affect later jobs.
- **FR-063**: Partial/unknown outcomes MUST be recorded explicitly with the number of labels already sent.

#### 打印机配置与目录

- **FR-070**: Printer settings MUST persist with the template (speed, density, print mode, label type, offsets, media handling, backfeed, port, target printer name).
- **FR-071**: The printer catalog MUST provide brand/model command-set recommendations; unknown brands MUST use a documented best-effort order.
- **FR-072**: Device differences MUST live in printer profile/capabilities, not in business components by brand.

#### 安全与边界

- **FR-080**: Native command payloads MUST be validated at the main-process boundary; empty payloads and invalid ports MUST be rejected.
- **FR-081**: Script lifecycle failures MUST block submission before any batch is sent.
- **FR-082**: Temporary command/serial files MUST be cleaned up on success and failure.

### Key Entities

- **LabelDoc / DataCtx**: 文档与一次打印的数据上下文（标签号、记录号、拷贝、总数、固定时钟）。
- **ResolvedPrintScene**: 与 UI/Fabric/协议无关的已解析场景（图元、位图、纸形、颜色表）。
- **PrintPlan / PrintPlanPage / PrintPlanCell**: 数量、拷贝、记录、槽位、拼版与序列号推进。
- **PrinterConfig / PortConfig**: 指令集、DPI、介质、偏移、端口与编码。
- **CommandPayload / CommandSegment**: 原生指令的文本/二进制分段与编码。
- **PrintTransportResult**: `accepted` / `failed` / `unknown` / `canceled` 及字节数/消息。
- **PrintLog**: JSONL 日志条目与解析数据快照。
- **PrinterCatalogEntry**: 品牌、型号、指令集、端口、DPI 与备注。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Windows 驱动与 TSPL/ZPL/CPCL 三套原生协议均可完成标签输出。
- **SC-002**: 驱动、文件、TCP、COM、USB、蓝牙、LPT、cloudbox 八类端口均通过配置校验与传输适配。
- **SC-003**: 25 张标签在 TCP 端口分为 24+1 两批；后批失败时日志为 `partial`、已发送 24、序列号仅推进 24。
- **SC-004**: 测试打印只输出一张，不写日志、不推进序列号。
- **SC-005**: 空数据库不产生任何打印输出，并给出明确状态。
- **SC-006**: 打印预览显示正确页数（1/1 或拼版页数）且图像非空。
- **SC-007**: 协议 golden 文件按字节长度、SHA-256 与关键令牌校验通过。
- **SC-008**: 协议适配器不重新解析数据源；所有输出路径共享同一 `ResolvedPrintScene`/`PrintPlan`。
- **SC-009**: 203/300/600 dpi 下物理标签尺寸保持不变，点阵尺寸按 DPI 换算。
- **SC-010**: `accepted`/`failed`/`unknown`/`canceled` 与 `partial` 结果在日志中可区分，并记录已发送数量。

## Assumptions

- 目标平台为 Windows 10/11 x64；驱动打印依赖系统打印队列，原生传输依赖 PowerShell/.NET 串口与 Windows 打印队列。
- 真实打印机/耗材的最终输出需要人工真机验证；自动化测试覆盖逻辑、协议与传输边界，不替代真机验收。
- 产品不生成 ESC/POS 指令；未收录品牌按尽力而为策略处理。
- 位图回退是设计边界，不是缺陷；RFID 图元保留原生命令。
- 打印数量/拷贝/物理张数上限为 100000 / 99999 / 1000000。
- `parity/` 真机对照材料不在本仓库；历史截图与矩阵保存在 `parity` 分支。

## Baseline Notes (As-Is)

以下为已知边界或已确认的后续决策：

- ESC/POS 当前未实现；已确认作为独立特性 `004-escpos` 实现，覆盖文字/条码/图片、
  控制命令（切纸/钱箱/对齐）与二维条码，并建立真机矩阵。
- 跨平台 macOS/Linux 当前未支持；已确认作为独立特性 `005-cross-platform` 实现，
  包含桌面构建与传输适配器（原生 Node 库：serialport、usb/libusb、CUPS/lp）。
- 中国邮政码不自研；需要时走打印机内建条码（已确认）。
- 未收录品牌的指令集为尽力而为，不保证 100% 正确。
- 真机兼容矩阵维持当前厂商文档范围，并在每次发布前抽测关键型号（已确认）。
- 预览/日志/取消的自动化测试使用受控替身；真实打印机断开、纸张/碳带错误等需人工验证。
- 位图回退的尺寸/内存上限保持现状，待真机测量后再决定是否调整（Q-005 默认）。

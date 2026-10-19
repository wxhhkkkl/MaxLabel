# Feature Specification: ESC/POS Command Support

**Feature Branch**: `004-escpos`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "在现有打印流水线上增加 ESC/POS 指令支持。覆盖文字、条码、图片、切纸/钱箱/对齐等控制命令、二维码/PDF417/DataMatrix，并建立真机矩阵。作为独立特性 004 实现，复用 003 的场景/计划/传输契约。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 在 ESC/POS 热敏打印机上打印标签 (Priority: P1)

用户选择 ESC/POS 打印机（58 mm 或 80 mm 热敏机），打印包含文字、一维条码和图片的标签；
输出通过现有端口/传输层发送，行为与 TSPL/ZPL/CPCL 一致。

**Why this priority**: ESC/POS 是票据/热敏标签设备最常见的指令集；当前不支持会限制设备兼容范围。

**Independent Test**: 选择一台 Epson 兼容 80 mm 打印机，打印 60×40 mm 标签（文字、Code128、图片），
检查初始化、编码、条码、位图与结束命令。

**Acceptance Scenarios**:

1. **Given** ESC/POS 打印机配置为 80 mm/203 dpi，**When** 打印文字与 Code128，
   **Then** 输出 ESC/POS 文本与条码命令，编码符合所选代码页。
2. **Given** 标签包含单色图片，**When** 打印，**Then** 图片以 GS v 0 位图输出，宽度不超过可打印宽度。
3. **Given** 打印数量与单签拷贝，**When** 打印，**Then** 数量/拷贝语义与 003 的 `PrintPlan` 一致。
4. **Given** 测试打印，**When** 提交，**Then** 只输出一张，不写日志、不推进序列号。

**Evidence**: `app/src/shared/print/engine.ts`, `scene.ts`, `plan.ts`,
`app/src/renderer/src/features/printing/printExecutor.ts`（复用路径）

---

### User Story 2 - 控制命令：切纸、钱箱、对齐 (Priority: P1)

用户按模板或打印机配置选择切纸（全切/半切）、钱箱触发、对齐、字号/加粗/下划线、
行距与走纸；这些控制命令与标签内容一起输出。

**Why this priority**: ESC/POS 设备常用于票据/货架标签，切纸和钱箱是基本工作流。

**Independent Test**: 配置切纸与钱箱，打印一张标签，检查对应控制命令出现在正确位置。

**Acceptance Scenarios**:

1. **Given** 模板启用切纸，**When** 打印，**Then** 在标签内容后输出切纸命令（全切/半切按配置）。
2. **Given** 启用钱箱，**When** 打印，**Then** 输出钱箱触发命令（引脚 2 或 5 按配置）。
3. **Given** 文字对齐/字号/加粗/下划线，**When** 打印，**Then** 对应 ESC/POS 样式命令生效。
4. **Given** 测试打印，**When** 启用切纸/钱箱，**Then** 控制命令仍按配置输出，但不写日志、不推进序列号。

**Evidence**: `app/src/shared/domain/printer.ts`（配置扩展点），
`app/src/shared/print/capabilities.ts`, `app/src/renderer/src/dialogs/PrinterSettings.tsx`

---

### User Story 3 - 二维码与二维条码 (Priority: P2)

用户使用 QR、PDF417、DataMatrix；设备支持原生命令时输出原生命令，不支持时整页/对象回退位图。

**Why this priority**: 二维条码是标签常见内容，但不同 ESC/POS 固件支持差异大。

**Independent Test**: 分别打印 QR、PDF417、DataMatrix；对不支持原生命令的型号验证位图回退。

**Acceptance Scenarios**:

1. **Given** 打印机能力档案支持 QR，**When** 打印 QR，**Then** 输出 GS ( k 二维码命令。
2. **Given** 能力档案不支持 PDF417/DataMatrix，**When** 打印，**Then** 回退为位图而不是静默丢弃。
3. **Given** 位图未准备好，**When** 打印，**Then** 阻止发送并给出明确状态。

**Evidence**: `app/src/shared/print/capabilities.ts`, `compat.ts`, `bitmap.ts`

---

### User Story 4 - 能力档案与降级 (Priority: P2)

系统按 ESC/POS 机型/固件能力档案决定原生命令或位图回退；未收录型号按安全默认处理。

**Why this priority**: ESC/POS 不是严格标准，型号/固件差异会导致静默错印。

**Independent Test**: 用支持/不支持二维条码的两个能力档案打印同一文档，验证命令差异与回退。

**Acceptance Scenarios**:

1. **Given** 能力档案声明不支持某特性，**When** 打印，**Then** 该页/对象回退位图并记录提示。
2. **Given** 未收录型号，**When** 选择 ESC/POS，**Then** 使用安全默认（仅基础文字/条码/图片）并提示。
3. **Given** 原生命令无法等价表达旋转/颜色/复杂文字，**When** 打印，**Then** 回退位图。

**Evidence**: `app/src/shared/print/capabilities.ts`, `compat.ts`

---

### User Story 5 - 配置、日志与兼容 (Priority: P2)

用户选择 ESC/POS 指令集，配置纸张宽度、DPI、代码页、切纸/钱箱、能力档案；打印日志、
测试打印、取消与失败语义与 003 一致。

**Why this priority**: 新指令集必须融入现有配置/日志/传输体系，不能形成第二套打印流程。

**Independent Test**: 保存/重开模板检查 ESC/POS 配置；打印并检查日志字段与状态。

**Acceptance Scenarios**:

1. **Given** ESC/POS 配置（纸张宽度/DPI/代码页/切纸/钱箱），**When** 保存模板并重开，**Then** 配置恢复。
2. **Given** 打印成功/失败/取消，**When** 结束，**Then** 日志使用 003 的状态与快照字段。
3. **Given** 指令通过 TCP/USB/文件发送，**When** 传输，**Then** 复用 003 的批处理与状态语义。

**Evidence**: `app/src/shared/domain/printer.ts`, `app/src/shared/print/logSchema.ts`,
`app/src/renderer/src/features/printing/printExecutor.ts`

---

### User Story 6 - 真机矩阵 (Priority: P3)

维护 ESC/POS 机型/固件矩阵（Epson TM 系列、芯烨、佳博、汉印等），发布前抽测关键型号。

**Why this priority**: 协议实现正确不等于真机输出正确；固件差异需要实测。

**Independent Test**: 按矩阵逐项记录机型、固件、纸张宽度、DPI、代码页、切纸/钱箱/二维条码结果。

**Acceptance Scenarios**:

1. **Given** 一台矩阵内机型，**When** 按清单打印，**Then** 结果记录为 pass/fail 并附固件版本。
2. **Given** 矩阵外机型，**When** 打印，**Then** 按未收录型号的安全默认处理并提示。

**Evidence**: `specs/004-escpos/verification/hardware-matrix.md`（待创建）

### Edge Cases

- 58 mm 打印机可打印宽度小于 80 mm；位图/条码宽度必须按能力档案裁剪或阻止。
- 代码页不支持中文时，必须回退位图或使用支持中文的代码页。
- 不支持切纸/钱箱的型号：控制命令应被忽略并提示，而不是报错中断内容。
- 二维码版本/纠错级别超出固件能力时回退位图。
- 位图未准备好时阻止发送。
- 钱箱引脚配置错误可能导致无动作，必须在日志/状态中提示。
- 未收录型号的默认能力必须保守，避免静默丢失内容。
- 文档包含 RFID 对象时，ESC/POS 无法执行写卡；必须明确拒绝并提示，不能静默跳过 RFID 写入。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `PrinterConfig` MUST accept `escpos` as a command set alongside TSPL/ZPL/CPCL.
- **FR-002**: ESC/POS output MUST consume the shared `ResolvedPrintScene` / `PrintPlan`; it MUST NOT re-resolve data sources or maintain a second geometry model.
- **FR-003**: The system MUST support 58 mm and 80 mm paper widths, 203/300 dpi, and the corresponding printable width.
- **FR-004**: Text output MUST support alignment, font size, bold, underline, reverse, line spacing and code page/encoding selection.
- **FR-005**: The system MUST support ESC/POS 1D barcode commands for the symbologies covered by the printer capability profile; unsupported symbologies MUST fall back to bitmap.
- **FR-006**: QR MUST use native ESC/POS QR commands when the profile supports them; PDF417/DataMatrix MUST use native commands when supported, otherwise rasterize.
- **FR-007**: Images MUST be converted to monochrome raster and emitted with GS v 0, respecting printable width and size limits.
- **FR-008**: The system MUST support cut (full/partial), cash drawer (pin 2/5), feed and initialization control commands, configurable per template/profile.
- **FR-009**: Unsupported native features (rotation, complex styling, colour, unknown barcode) MUST force page/object rasterization; sending MUST be blocked if the bitmap is not ready.
- **FR-010**: ESC/POS MUST reuse the existing port/transport, batching, cancellation and result semantics from 003.
- **FR-011**: Test print, print logs, serial advancement and partial/unknown semantics MUST match 003.
- **FR-012**: Printer settings MUST persist with the template, including ESC/POS paper width, DPI, code page, cut and cash-drawer options.
- **FR-013**: The system MUST provide ESC/POS capability profiles for known models and a conservative default for unknown models.
- **FR-014**: Unsupported control commands MUST be ignored with a warning rather than aborting the content.
- **FR-015**: A real-device hardware matrix MUST be maintained and sampled before releases.

### Key Entities

- **EscPosProfile**: paper width, DPI, printable width, code page support, barcode/2D support, cut/drawer support, model/firmware.
- **EscPosConfig**: command set, paper width, DPI, encoding/code page, cut mode, cash drawer pin, feed.
- **EscPosCommands**: initialization, text/style, 1D barcode, 2D barcode, raster, control commands.
- **CapabilityProfile**: existing print capability model extended for ESC/POS.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: ESC/POS prints text, Code128, QR and a monochrome image on 58 mm and 80 mm devices.
- **SC-002**: Cut, cash drawer, alignment and text-style commands appear in the correct order.
- **SC-003**: QR/PDF417/DataMatrix use native commands when supported; unsupported combinations rasterize or block, never silently drop content.
- **SC-004**: ESC/POS tasks share 003's counts, copies, serial, log, cancel and failure semantics.
- **SC-005**: Settings round-trip through template save/open.
- **SC-006**: The hardware matrix covers at least the agreed Epson-compatible models and records firmware/paper-width results.
- **SC-007**: Existing TSPL/ZPL/CPCL tests and E2E remain green; fast gate stays under 2 minutes.

## Assumptions

- Target devices are Epson-compatible ESC/POS thermal printers; exact models are recorded in the hardware matrix.
- Windows transport is available first; macOS/Linux transport arrives with `005-cross-platform`.
- 58 mm and 80 mm are the initial paper widths; other widths require a new profile.
- Code page selection is limited to documented printer code pages; Chinese without a supported code page falls back to raster.
- Cash drawer support is optional and device-dependent.
- Receipt-style full-page layout and kitchen printing are out of scope.

## Out of Scope

- Non-ESC/POS receipt protocols.
- Full receipt formatting/kitchen-ticket workflows.
- Driver-dialog automation.
- Cross-platform transport (owned by `005-cross-platform`).

## Dependencies

- `003-printing-pipeline`: shared scene/plan/transport/log contracts.
- `005-cross-platform`: macOS/Linux transport for ESC/POS devices.

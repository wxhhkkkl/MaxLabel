# Feature Specification: Cross-Platform Desktop Builds and Transports

**Feature Branch**: `005-cross-platform`

**Created**: 2026-10-18

**Status**: Implemented and CI-verified; manual macOS/Linux device checks pending (2026-10-19)

**Input**: User description: "立即支持 macOS + Linux 桌面构建与传输，使用原生 Node 库（serialport、usb/libusb、CUPS/lp）实现驱动、串口、USB、蓝牙等传输，保留 Windows 现有行为；作为独立特性 005 交付。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - macOS 桌面构建与运行 (Priority: P1)

用户在 macOS（Intel 与 Apple Silicon）安装并运行 MaxLabel，打开/编辑/保存模板，
使用 TCP、文件、串口、USB 或 CUPS 打印。

**Why this priority**: macOS 是当前桌面用户的重要平台；没有构建产物就无法交付。

**Independent Test**: 在 macOS 13+（x64 与 arm64）构建并启动应用，打开模板、保存、
通过文件/TCP 与一台 CUPS 打印机完成打印。

**Acceptance Scenarios**:

1. **Given** macOS x64/arm64，**When** 构建应用，**Then** 生成可安装的 dmg/zip 产物并启动。
2. **Given** CUPS 打印机队列，**When** 选择驱动打印，**Then** 任务提交到 CUPS 并返回明确状态。
3. **Given** 串口/USB 打印机，**When** 发送原生指令，**Then** 传输适配器完成发送并返回 003 的状态语义。
4. **Given** 未配置/无权限的设备，**When** 打印，**Then** 返回可操作的错误信息，不崩溃。

**Evidence**: `specs/003-printing-pipeline/contracts/transport.md`,
`app/src/main/printing/commandTransport.ts`（现 Windows 实现）

---

### User Story 2 - Linux 桌面构建与运行 (Priority: P1)

用户在 Linux（x64，后续 arm64）安装并运行 MaxLabel，使用 CUPS、串口、USB、TCP/文件打印。

**Why this priority**: Linux 是工业/自助场景的常见平台，与 macOS 共享大部分适配器。

**Independent Test**: 在 Ubuntu 22.04/24.04 构建并启动应用，完成模板打开/保存与 CUPS 打印。

**Acceptance Scenarios**:

1. **Given** Ubuntu 22.04/24.04，**When** 构建应用，**Then** 生成 AppImage/deb 产物并启动。
2. **Given** CUPS 队列，**When** 驱动打印，**Then** 任务提交成功并返回状态。
3. **Given** 串口/USB 设备，**When** 指令打印，**Then** 发送成功或返回明确失败。
4. **Given** 缺少 udev 权限，**When** 访问 USB 设备，**Then** 提示权限/udev 配置，不静默失败。

**Evidence**: `specs/003-printing-pipeline/contracts/transport.md`

---

### User Story 3 - 跨平台传输适配器 (Priority: P1)

传输层按平台选择适配器：Windows 保持现有驱动/PowerShell/USB 队列实现；
macOS/Linux 使用 CUPS/lp、serialport、usb/libusb、系统串口设备；TCP/文件两端一致。

**Why this priority**: 传输是打印能否落地的关键；适配器必须共享同一端口/状态契约。

**Independent Test**: 在三个平台上对同一份指令分别走 TCP、文件、串口、USB、驱动路径，
检查发送结果、状态与错误信息。

**Acceptance Scenarios**:

1. **Given** `port.type=tcp|file`，**When** 任意平台打印，**Then** 行为与 003 完全一致。
2. **Given** `port.type=com|bluetooth`，**When** macOS/Linux 打印，**Then** 使用 serialport 打开/写入，并按波特率/数据位/校验/停止位/流控配置。
3. **Given** `port.type=usb`，**When** macOS/Linux 打印，**Then** 通过 usb/libusb（或系统等价设备）发送原始字节。
4. **Given** `port.type=driver`，**When** macOS/Linux 打印，**Then** 通过 CUPS/lp 提交任务并返回 accepted/failed/unknown。
5. **Given** `port.type=lpt`，**When** macOS/Linux 打印，**Then** 返回“不支持该端口”的明确错误。

**Evidence**: `app/src/main/printing/commandTransport.ts`,
`specs/003-printing-pipeline/contracts/transport.md`

---

### User Story 4 - 设备枚举与能力映射 (Priority: P2)

系统枚举 CUPS 队列、串口、USB 设备，并映射到打印机目录/能力档案；
端口校验在三个平台保持一致。

**Why this priority**: 用户必须先看到可用设备，才能选择正确的端口。

**Independent Test**: 在 macOS/Linux 插拔串口/USB 设备，刷新列表，检查枚举与端口配置。

**Acceptance Scenarios**:

1. **Given** Linux/macOS，**When** 打开打印机设置，**Then** 列出 CUPS 队列、串口和可用 USB 设备。
2. **Given** 未收录品牌，**When** 选择设备，**Then** 使用现有 best-effort 指令集推荐。
3. **Given** 无效端口配置，**When** 保存/打印，**Then** 与 Windows 使用同一校验规则拒绝。

**Evidence**: `app/src/shared/domain/printer.ts`, `app/src/main/ipc/validation.ts`

---

### User Story 5 - 构建、CI 与发布 (Priority: P2)

团队在 CI 中构建 Windows/macOS/Linux 产物，运行单元/契约/集成/E2E（平台可运行部分），
并记录安装包、签名与已知限制。

**Why this priority**: 跨平台能力必须持续可构建，不能只在开发机上手写产物。

**Independent Test**: PR 触发三平台 CI，产物可下载；Windows 门禁保持全绿。

**Acceptance Scenarios**:

1. **Given** 一次 PR，**When** CI 运行，**Then** Windows 快速门禁与三平台构建分别执行。
2. **Given** macOS/Linux 构建，**When** 完成，**Then** 上传 dmg/zip/AppImage/deb 产物。
3. **Given** 缺少签名/公证凭据，**When** 构建，**Then** 明确标记未签名产物而不是静默失败。

**Evidence**: `.github/workflows/ci.yml`（现有 Windows 门禁）

---

### User Story 6 - ESC/POS 跨平台 (Priority: P3)

004 的 ESC/POS 指令在 macOS/Linux 上通过同一传输契约发送。

**Why this priority**: 新指令集应天然复用跨平台传输，而不是再做一套平台分支。

**Independent Test**: 在 macOS/Linux 用 ESC/POS 设备打印文字/条码/图片，检查命令与状态。

**Acceptance Scenarios**:

1. **Given** 004 的 ESC/POS 配置，**When** macOS/Linux 打印，**Then** 指令与 Windows 一致（编码/能力档案相同）。
2. **Given** 平台差异（驱动/CUPS），**When** 打印，**Then** 只有传输适配器不同，指令生成不变。

**Evidence**: `specs/004-escpos/spec.md`, `specs/003-printing-pipeline/contracts/transport.md`

### Edge Cases

- macOS 未签名/未公证应用首次启动被 Gatekeeper 阻止；必须提供明确说明。
- Linux 无 udev 规则时 USB 设备不可访问；提示配置而不是静默失败。
- 串口设备被占用/拔出；返回明确失败并清理句柄。
- CUPS 队列暂停/缺纸；状态不能伪装成 accepted。
- 蓝牙未配对或 RFCOMM 设备不存在；返回可操作错误。
- 原生 Node 模块（serialport/usb）与 Electron ABI 不匹配；构建必须重建。
- 无 CUPS/lp 的最小 Linux 环境；驱动打印返回明确不可用。
- 不同发行版的库依赖差异；安装包需声明依赖或自带。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST produce macOS x64/arm64 and Linux x64 desktop builds (AppImage/deb; dmg/zip for macOS).
- **FR-002**: The transport layer MUST select a platform adapter while preserving the 003 `PortConfig`/`PrintTransportResult` contract.
- **FR-003**: TCP and file ports MUST remain platform-independent and behavior-identical.
- **FR-004**: macOS/Linux serial (COM/Bluetooth) MUST use a native Node serial library with baud/data-bits/parity/stop-bits/flow-control support.
- **FR-005**: macOS/Linux USB raw output MUST use a native USB library (usb/libusb) or an equivalent documented device path.
- **FR-006**: macOS/Linux driver printing MUST submit to CUPS via `lp`/`lpstat` or a documented CUPS API, reporting accepted/failed/unknown.
- **FR-007**: LPT MUST return a clear unsupported error on macOS/Linux.
- **FR-008**: Device enumeration MUST list CUPS queues, serial ports and accessible USB devices; port validation MUST match the shared rules.
- **FR-009**: Native modules MUST be rebuilt for the Electron ABI; packaging MUST unpack them from asar.
- **FR-010**: EC/POS (004) commands MUST be generated platform-independently and sent through the selected adapter.
- **FR-011**: CI MUST build/test the Windows gate and the macOS/Linux builds; artifacts MUST be uploaded.
- **FR-012**: Signing/notarization status MUST be explicit in build artifacts and release notes.
- **FR-013**: Errors MUST be actionable (permissions/udev/CUPS/service) and MUST NOT crash the app.
- **FR-014**: Existing Windows transport behavior, tests and E2E MUST remain green.

### Key Entities

- **PlatformTransportAdapter**: platform-specific implementation of send/enumerate/cancel for a port type.
- **CupsQueue**: name, URI, status, default flag.
- **SerialDevice / UsbDevice**: path/vendor/product/serial, permissions status.
- **BuildArtifact**: platform, arch, installer type, signing status.
- **NativeModuleConfig**: rebuild/unpack rules for serialport/usb.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: macOS x64/arm64 and Linux x64 artifacts build and launch.
- **SC-002**: TCP/file/serial/USB/driver paths work on macOS and Linux with real devices or documented substitutes.
- **SC-003**: LPT and unavailable services return clear errors; no crash.
- **SC-004**: Windows fast gate and E2E remain green.
- **SC-005**: CI produces three-platform build artifacts and reports signing status.
- **SC-006**: Device enumeration lists CUPS/serial/USB devices and uses the same validation rules.
- **SC-007**: ESC/POS output is identical across platforms (transport differs only).
- **SC-008**: A hardware/platform matrix records macOS/Linux models, CUPS versions, udev/permissions and results.

## Assumptions

- macOS 13+ (x64/arm64) and Ubuntu 22.04/24.04 x64 are the initial targets; other distros are best effort.
- CUPS/lp is available on macOS/Linux; minimal systems may need package installation.
- serialport and usb/libusb are acceptable native dependencies; they will be rebuilt for Electron and unpacked from asar.
- Code signing/notarization credentials may not be available; unsigned artifacts are allowed but must be labeled.
- Bluetooth requires OS-level pairing; the app accesses the resulting serial/RFCOMM device.
- 005 does not change Windows transport behavior or printing protocol generation.

## Out of Scope

- Mobile platforms and web builds.
- Windows transport rewrite.
- MSI/MSIX packaging changes.
- Windows NSIS installer/uninstaller pages and user-data retention behavior
  (currently no dedicated specification; TODO(待确认)).
- Full accessibility/localization work.

## Dependencies

- `003-printing-pipeline`: transport contract, ports/status semantics, logging.
- `004-escpos`: ESC/POS command generation consumed by the cross-platform transport.

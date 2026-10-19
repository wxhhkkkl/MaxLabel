# Implementation Plan: Cross-Platform Builds and Transports

**Branch**: `005-cross-platform` | **Date**: 2026-10-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-cross-platform/spec.md`

## Summary

Add macOS (x64/arm64) and Linux (x64) desktop builds and platform transport adapters while
preserving Windows behavior. The transport layer is refactored behind a
`PlatformTransportAdapter` interface; Windows keeps its current PowerShell/queue
implementation, while macOS/Linux use Electron's print pipeline/CUPS for driver output,
`serialport` for COM/Bluetooth, and `usb`/libusb for raw USB. TCP/file remain unchanged.

The 003 `PortConfig`/`PrintTransportResult` contract and the 004 ESC/POS command builder
are the compatibility boundary. No protocol generation, scene resolution or print-plan
logic changes.

## Technical Context

**Language/Version**: TypeScript 5.9.3; Node.js ≥ 22.12.0; Electron 44.3.0 (CJS package)

**Primary Dependencies**: Electron 44.3.0, electron-builder 26.15.4, Vitest 5.0.5,
Playwright 1.64.1, `serialport` (native), `usb`/libusb (native); existing iconv-lite,
bwip-js, fabric

**Storage**: Existing JSONL log/template storage; temporary print/firmware files on all
platforms

**Testing**: Vitest unit/integration with adapter doubles; Windows regression suite;
Playwright Electron smoke on macOS/Linux where CI permits; manual hardware matrix

**Target Platform**: Windows 10/11 x64 (unchanged), macOS 13+ x64/arm64, Ubuntu
22.04/24.04 x64 (arm64 best effort)

**Project Type**: Desktop application (Electron)

**Performance Goals**: No regression to the Windows fast gate; build matrix completes in a
bounded CI time; serial/USB writes remain bounded by 003 batch limits

**Constraints**: Preserve Windows behavior and tests; no shell injection; native modules
rebuilt for Electron and unpacked from asar; device access errors must be actionable;
signing/notarization status must be explicit

**Scale/Scope**: 3 platforms, 8 port types, 6 user stories, 14 FR, 8 SC

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status | Notes |
|-----------|------|--------|-------|
| I. 测试先行（TDD） | Adapter tests written first | PASS (plan) | The plan orders adapter contract tests before implementation and keeps Windows tests green. |
| II. 先澄清，不猜测 | Platform/scope clarified | PASS | Owner confirmed macOS+Linux builds, native Node libraries and independent feature 005. |
| III. 巨大架构变更先确认 | Architecture change approved | PASS | Owner approved cross-platform builds and transports as feature 005. |
| Evidence rule | Claims trace to code/tests | PASS | Plan cites the Windows transport, 003 contract and 004 builder. |

**Post-design re-check**: unchanged. The adapter refactor preserves the public transport
contract; protocol/scene/plan code is untouched.

## Project Structure

### Documentation (this feature)

```text
specs/005-cross-platform/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── transport-adapters.md
│   ├── build-artifacts.md
│   └── device-enumeration.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
app/
├── package.json                    # mac/linux build targets, native deps, asarUnpack
├── electron-builder.yml (or build) # mac dmg/zip, linux AppImage/deb
├── src/main/printing/
│   ├── commandTransport.ts         # facade: select adapter, keep exports
│   └── transports/
│       ├── types.ts                # PlatformTransportAdapter contract
│       ├── windows.ts              # existing PowerShell/queue implementation
│       ├── unix.ts                 # CUPS/lp + enumeration
│       ├── serial.ts               # serialport adapter (COM/Bluetooth)
│       ├── usb.ts                  # usb/libusb raw adapter
│       └── index.ts                # platform selection
├── src/main/ipc/registerPrintIpc.ts # printer enumeration/device facts per platform
├── src/renderer/src/dialogs/PrinterSettings.tsx # platform-aware port labels
└── tests/
    ├── unit/main/transport-adapter.test.ts
    ├── integration/main/unix-transport.test.ts
    ├── integration/main/serial-usb-transport.test.ts
    └── integration/main/printing-transport.test.ts # Windows regression
```

**Structure Decision**: Keep `commandTransport.ts` as the public facade so IPC and
executor code do not change. Platform-specific code moves into `transports/`; protocol
builders and scene/plan stay platform-neutral.

## Implementation Phases

1. **Adapter contract tests (red)**
   - Define `PlatformTransportAdapter` (send, list ports, list printers, cancel) in
     `transports/types.ts`.
   - Add tests for platform selection (`win32` vs `darwin`/`linux`), unsupported ports and
     error mapping using injected fakes.
2. **Windows adapter extraction**
   - Move the existing PowerShell/queue/COM/USB code into `transports/windows.ts`.
   - Keep behavior byte/status-identical; run the 003 transport/executor tests and E2E.
3. **CUPS/lp adapter (macOS/Linux driver path)**
   - Use Electron's print pipeline for the existing driver flow (it delegates to CUPS on
     macOS/Linux); add `lpstat -p -d` queue enumeration and `lp -d <queue> -o raw <file>`
     for raw/silent paths.
   - Map failures/timeouts to `accepted`/`failed`/`unknown`; never shell-interpolate
     user input (use `execFile` args).
4. **Serial/Bluetooth adapter**
   - Use `serialport` for COM/Bluetooth devices on macOS/Linux; map baud/data
     bits/parity/stop bits/flow control; list devices via `SerialPort.list()`.
   - Return actionable errors for missing/busy/permission-denied devices.
5. **USB adapter**
   - Use `usb`/libusb to find/claim the device and write raw bytes; list accessible
     devices; document udev/permission handling on Linux.
   - Missing permission or unsupported device returns a clear failure.
6. **Build and packaging**
   - Add macOS x64/arm64 `dmg`/`zip` and Linux x64 `AppImage`/`deb` targets.
   - Declare native dependencies; rebuild for Electron; unpack from asar.
   - Label unsigned artifacts; signing/notarization configuration is opt-in.
7. **CI/build matrix**
   - Keep the Windows fast/E2E gates; add macOS/Linux build jobs and artifact upload.
   - Run platform-runnable tests; record signing status.
8. **Enumeration and UI**
   - Printer settings lists CUPS queues/serial/USB devices on unix; LPT shows unsupported.
   - Reuse existing port validation; no protocol/UI duplication.
9. **Documentation and hardware matrix**
   - Add `verification/hardware-matrix.md` for macOS/Linux devices, CUPS versions,
     udev/permissions and results.

## Key Decisions

1. **Facade + adapters** — `commandTransport.ts` remains the public API; platform code is
   selected by `process.platform`.
2. **Windows behavior frozen** — extraction must preserve statuses, batching and bytes;
   the 003/004 tests are the regression gate.
3. **Driver path uses Electron/CUPS** — the existing raster driver flow already delegates
   to the OS print system; CUPS enumeration uses `lpstat`, raw/silent paths use `lp`.
4. **Native serial/USB libraries** — `serialport` and `usb` are used behind adapters so
   they can be mocked in tests and swapped if needed.
5. **Explicit unsupported ports** — LPT on macOS/Linux returns a clear error; no silent
   fallback.
6. **Native module hardening** — rebuild for Electron ABI, unpack from asar, and fail the
   build clearly if the module is missing.
7. **Unsigned artifacts are labeled** — signing/notarization is a release decision, not a
   silent failure.
8. **No protocol changes** — ESC/POS/TSPL/ZPL/CPCL builders remain platform-independent.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Native module ABI mismatch with Electron | Rebuild in postinstall/CI; verify `serialport`/`usb` load in a smoke test |
| USB permission/udev on Linux | Enumerate access, return actionable message, document udev rules |
| CUPS absent on minimal Linux | Detect `lp`/`lpstat`; return clear error; driver dialog fallback |
| Gatekeeper blocks unsigned macOS app | Label unsigned artifacts; document right-click open |
| CI cost/time for three platforms | Separate build jobs, caches, artifact uploads only |
| Platform behavior drift | Adapter contract tests + Windows regression suite |
| Bluetooth pairing variance | Use OS-paired serial/RFCOMM device; clear error when absent |
| PDF417/DataMatrix/ESC-POS firmware variance | 004 profile/hardware matrix remains authoritative |

## Verification

```bash
cd app
npm test
npm run test:coverage
npm run test:e2e
# CI: macOS x64/arm64 + Linux x64 build jobs, artifact upload
```

Manual: complete `specs/005-cross-platform/verification/hardware-matrix.md` on macOS and
Linux with CUPS versions, serial/USB devices, udev/permissions and print results.

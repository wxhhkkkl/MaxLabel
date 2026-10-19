# Research: Cross-Platform Builds and Transports

**Feature**: `005-cross-platform` | **Date**: 2026-10-19

## D-001: Platform adapter behind the existing transport facade

- **Decision**: Keep `app/src/main/printing/commandTransport.ts` as the public facade and
  move platform implementations into `app/src/main/printing/transports/` selected by
  `process.platform`.
- **Rationale**: `registerPrintIpc.ts` and the renderer already depend on the facade
  exports; an adapter boundary keeps Windows behavior stable and makes unix code testable.
- **Alternatives considered**: Duplicate `commandTransport` per platform (rejected: import
  churn and drift); runtime brand/platform branches inside one file (rejected: untestable).
- **Evidence**: `app/src/main/printing/commandTransport.ts`,
  `app/src/main/ipc/registerPrintIpc.ts`.

## D-002: Windows adapter is an extraction, not a rewrite

- **Decision**: Move the existing PowerShell/queue/LPT/COM/USB code into
  `transports/windows.ts` without behavioral changes.
- **Rationale**: Windows is the current production target; the 003 transport tests and
  E2E are the compatibility oracle.
- **Alternatives considered**: Rewrite Windows transports on a native library (rejected:
  unnecessary risk).
- **Evidence**: 003 `contracts/transport.md`,
  `tests/integration/main/printing-transport.test.ts`.

## D-003: Driver printing uses Electron/CUPS

- **Decision**: Keep the existing raster driver flow via Electron's print pipeline, which
  delegates to CUPS on macOS/Linux; add `lpstat`/`lp` for queue enumeration and raw/silent
  submission where needed.
- **Rationale**: The driver path already renders pages and calls the OS print system;
  Electron is cross-platform. CUPS tools provide device facts and a raw fallback.
- **Alternatives considered**: Reimplement raster printing with `lp` for all cases
  (rejected: loses the existing dialog/behavior); CUPS-only (rejected: macOS/Windows
  differences).
- **Evidence**: `app/src/main/ipc/registerPrintIpc.ts` (`webContents.print`,
  `getPrintersAsync`).

## D-004: `serialport` for COM/Bluetooth

- **Decision**: Use the `serialport` native module for macOS/Linux serial and Bluetooth
  SPP; map baud/data bits/parity/stop bits/flow control from `PortConfig`.
- **Rationale**: Provides device enumeration and a stable Node API across platforms; the
  existing Windows PowerShell path stays for Windows.
- **Alternatives considered**: `stty` + device files (rejected: fragile framing/flow
  control); keeping PowerShell on unix (rejected: unavailable).
- **Evidence**: `app/src/shared/domain/printer.ts` serial options,
  `app/src/main/printing/commandTransport.ts` (`writeSerialWindows`).

## D-005: `usb`/libusb for raw USB

- **Decision**: Use the `usb` native module to locate/claim a USB printer interface and
  write raw bytes on macOS/Linux; enumerate accessible devices.
- **Rationale**: Raw USB output is required for devices not exposed as serial ports; the
  library is the common Node choice.
- **Alternatives considered**: System `usblp`/device files (rejected: platform-specific
  and permission-heavy); Windows-style queue access (rejected: not available).
- **Evidence**: `app/src/main/printing/commandTransport.ts` (`writeRawToWindowsQueue`).

## D-006: Build targets

- **Decision**: Add macOS x64/arm64 `dmg`/`zip` and Linux x64 `AppImage`/`deb` targets to
  electron-builder; keep Windows NSIS unchanged. Linux arm64 is best effort.
- **Rationale**: Covers the agreed platforms while keeping the release matrix manageable.
- **Alternatives considered**: Linux arm64 first (rejected: no confirmed target); snap/flatpak
  (rejected: extra packaging work).
- **Evidence**: `app/package.json` (`build` section).

## D-007: Native module rebuild and asar unpack

- **Decision**: Declare `serialport`/`usb` explicitly, rebuild for the Electron ABI, and
  unpack native binaries from asar (`asarUnpack`).
- **Rationale**: Native modules cannot load from inside asar and must match Electron's ABI.
- **Alternatives considered**: No asar (rejected: slower install/security); dynamic
  optional loading without build enforcement (rejected: silent runtime failure).
- **Evidence**: `app/package.json`, electron-builder docs.

## D-008: CI three-platform matrix

- **Decision**: Keep Windows fast/E2E jobs; add macOS and Linux build jobs with artifact
  uploads. Run platform-runnable tests in each job.
- **Rationale**: Cross-platform claims must be continuously buildable, not one-off local
  builds.
- **Alternatives considered**: Build only on release (rejected: late failures); single
  matrix job (rejected: unclear platform status).
- **Evidence**: `.github/workflows/ci.yml`.

## D-009: Signing/notarization is explicit

- **Decision**: Unsigned artifacts are allowed but labeled; signing/notarization uses
  optional CI secrets, and absence is reported.
- **Rationale**: Credentials may not be available; a silent unsigned release is worse than
  an explicit one.
- **Alternatives considered**: Block all builds without signing (rejected: blocks
  development); pretend signing (rejected).
- **Evidence**: spec FR-012; release notes.

## D-010: No shell injection

- **Decision**: Use `execFile` argument arrays (no shell interpolation) for `lpstat`/`lp`
  and any system commands; validate host/port/queue names.
- **Rationale**: Printer names, paths and user input must not become shell syntax.
- **Alternatives considered**: `exec` with strings (rejected: injection risk).
- **Evidence**: existing `execFileAsync` usage in `commandTransport.ts`,
  `main/ipc/validation.ts`.

## Open Questions

| ID | Question | Default |
|----|----------|---------|
| Q-001 | Do we have Apple signing/notarization credentials? | Unsigned artifacts labeled; add secrets later. |
| Q-002 | Which Linux distributions are release-supported? | Ubuntu 22.04/24.04 x64; others best effort. |
| Q-003 | Is Linux arm64 required? | Best effort; x64 is the release gate. |
| Q-004 | How are USB udev rules distributed? | Document rules; app reports permission errors with guidance. |
| Q-005 | Which Bluetooth stack/device path is supported? | OS-paired RFCOMM serial device via serialport. |
| Q-006 | Should raw `lp` be used for silent driver printing or keep the dialog? | Keep the existing dialog; `lp` for raw/queue paths. |
| Q-007 | Are macOS CI runners able to launch Electron E2E? | Build smoke first; E2E if runner permits. |

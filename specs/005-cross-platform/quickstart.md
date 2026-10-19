# Quickstart: Cross-Platform Builds and Transports

**Feature**: `005-cross-platform` | **Date**: 2026-10-19

## Prerequisites

- Node.js ≥ 22.12.0; `npm install`
- macOS 13+ (x64/arm64) or Ubuntu 22.04/24.04 x64
- CUPS (`lp`, `lpstat`) for driver printing
- Serial/USB permissions (Linux udev rules as documented)

## Build

```bash
cd app
npm install
npm run build

# macOS
npx electron-builder --mac dmg zip --x64 --arm64

# Linux
npx electron-builder --linux AppImage deb --x64
```

Expected: artifacts under `release/` with platform/arch/target and signing status.

## Tests

```bash
cd app
npm test
npm run test:coverage
npm run test:e2e
```

Expected: Windows gate unchanged; adapter selection tests pass; platform-runnable E2E
passes (headless/CI as permitted).

## Manual Device Checks

- [ ] CUPS queue appears and driver printing submits successfully.
- [ ] `lpstat -p -d` permissions/errors are actionable.
- [ ] Serial device prints via `serialport`; baud/framing matches config.
- [ ] Bluetooth SPP device prints via the OS-paired RFCOMM path.
- [ ] USB printer is listed and raw output succeeds; Linux udev/permission error is clear.
- [ ] LPT returns unsupported on macOS/Linux.
- [ ] TCP/file paths behave identically to Windows.
- [ ] ESC/POS output is identical across platforms (transport differs only).
- [ ] Native modules load from the packaged app (no asar/ABI error).

## Explicitly Not Automated

- CUPS/queue behavior on every distribution.
- USB permissions/udev configuration.
- Bluetooth pairing and firmware differences.
- Apple signing/notarization without credentials.
- Real print quality/scan grade.

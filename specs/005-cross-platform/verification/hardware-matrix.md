# Cross-Platform Hardware Matrix

**Feature**: `005-cross-platform` | **Status**: CI builds verified; device checks pending

## CI Build Results (2026-10-19, run 39185795944)

| Platform | Artifacts | Result |
|----------|-----------|--------|
| Windows | fast gate + E2E (362 tests, 7 E2E) | pass |
| macOS | dmg/zip, x64/arm64 (unsigned) | pass |
| Linux | AppImage/deb, x64 (unsigned) | pass |

Native `serialport`/`usb` modules rebuilt during packaging. Runtime device checks below
still require real hardware.

| Date | OS | Version | Arch | Device | Transport | CUPS | Driver | Result | Notes |
|------|----|---------|------|--------|-----------|------|--------|--------|-------|
|      | macOS / Linux |  | x64/arm64 |  | driver/file/TCP/COM/USB/BT/LPT |  |  | pass/fail | |

## Checklist

- [ ] macOS x64 and arm64 app launches (signed or labeled unsigned).
- [ ] Linux x64 app launches (AppImage/deb).
- [ ] CUPS queue enumerated and driver print submitted.
- [ ] `lpstat`/`lp` missing or permission error is actionable.
- [ ] Serial print with baud/data bits/parity/stop bits/flow control.
- [ ] Bluetooth SPP via paired RFCOMM device.
- [ ] USB raw output; Linux udev/permission error is actionable.
- [ ] LPT returns unsupported on macOS/Linux.
- [ ] TCP/file identical to Windows.
- [ ] ESC/POS output identical across platforms.
- [ ] Native modules load from the packaged app.
- [ ] Signing/notarization status recorded.

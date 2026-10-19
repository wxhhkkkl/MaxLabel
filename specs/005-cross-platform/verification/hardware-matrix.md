# Cross-Platform Hardware Matrix

**Feature**: `005-cross-platform` | **Status**: CI builds, signing reporting and packaged native-module load verified; device checks pending

## CI Build Results (2026-10-19)

| Run | Platform | Artifacts | Result |
|-----|----------|-----------|--------|
| 39185795944 | Windows | fast gate + E2E (362 tests, 7 E2E) | pass |
| 39185795944 | macOS | dmg/zip, x64/arm64 (unsigned) | pass |
| 39185795944 | Linux | AppImage/deb, x64 (unsigned) | pass |
| 39188109347 | all jobs | Windows fast/E2E, macOS, Linux | pass |
| 39188830877 | macOS + Linux | packaged `serialport`/`usb` load smoke | pass |

Native `serialport`/`usb` modules rebuilt during packaging. The macOS/Linux jobs write
the signing status to the job summary and to `release/SIGNING-STATUS.txt` (uploaded with
the artifacts); this was verified by run 39188109347. Run 39187759211 failed because an
empty `CSC_LINK` secret was passed to electron-builder; `420528a` exports the variables
only when the secret is non-empty.

Runtime device checks below still require real hardware.

## Still Pending

- T010/T013: manual macOS/Ubuntu device and permission checks (real hardware).

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
- [x] Native modules load from the packaged app (CI smoke, run 39188830877).
- [x] Signing/notarization status recorded (CI step verified in run 39188109347).

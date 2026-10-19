# Quickstart: Printing Pipeline and Devices

**Feature**: `003-printing-pipeline` | **Date**: 2026-10-18

## Automated Validation

```bash
cd app

# Unit: scene, plan, protocols, device output
npx vitest run --project unit tests/unit/shared/print

# Contract: byte-exact protocol goldens
npx vitest run --project contracts tests/contracts/protocol-golden.test.ts

# Integration: transport and executor orchestration
npx vitest run --project integration \
  tests/integration/main/printing-transport.test.ts \
  tests/integration/renderer/print-executor.test.ts

# E2E: preview plus renderer pixel/bitmap-cache harness
env -u ELECTRON_RUN_AS_NODE npx playwright test \
  tests/e2e/print-preview.spec.ts \
  tests/e2e/render-harness.spec.ts
```

Expected:

- Unit/contract/integration commands exit 0.
- Protocol goldens match byte length, SHA-256 and tokens.
- Executor tests cover driver/command success, failure, unknown, partial,
  test print, empty database and script-hook blocking.
- E2E preview shows a rendered page; the render harness passes pixel and cache checks.

## Full Gate

```bash
cd app
npm test
npm run test:coverage
npm run test:e2e
```

Expected: fast suite < 2 minutes; coverage ≥ 80% lines; 7 E2E specs pass.

## Manual Hardware Checklist

These are not automated; run on real devices when validating a release:

- [ ] Windows driver printer: print count × copies, verify page order and content.
- [ ] Zebra device via ZPL: text, Code128, QR, DataMatrix, PDF417, image.
- [ ] TSC/佳博/汉印/芯烨/得力/启锐 via TSPL: same label; check scan quality.
- [ ] CPCL device: text, Code128, QR, PDF417, image.
- [ ] USB queue: confirmed completion vs incomplete/unknown behavior.
- [ ] TCP/COM/Bluetooth: disconnect during send; status must be `failed`/`unknown`.
- [ ] LPT port: send to `LPT1`; invalid name rejected.
- [ ] RFID: EPC write and lock (firmware-dependent).
- [ ] Paper out / ribbon out / cover open: task must not report success.
- [ ] Chinese text: verify GBK and UTF-8 encodings on both native protocols.

## Explicitly Not Verified Automatically

- Physical print quality, barcode scan grade and alignment on real media.
- Firmware-specific RFID behavior.
- Driver dialog interactions (system UI).
- Every brand/model in the catalog; the matrix is based on vendor documentation.
- ESC/POS and Chinese Post barcode, which are not implemented.

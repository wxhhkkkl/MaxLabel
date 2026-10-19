# Quickstart: ESC/POS Command Support

**Feature**: `004-escpos` | **Date**: 2026-10-19

## Automated Validation

After implementation:

```bash
cd app
npx vitest run --project unit tests/unit/shared/print/escpos.test.ts tests/unit/shared/domain/printer-escpos.test.ts
npx vitest run --project contracts tests/contracts/escpos-golden.test.ts
npx vitest run --project integration tests/integration/renderer/print-executor-escpos.test.ts
npm test
npm run test:coverage
npm run test:e2e
```

Expected:

- Builder tests cover text/styles, 1D, QR/PDF417/DataMatrix, raster, cut, drawer, code page
  and fallback.
- Golden test matches byte length, SHA-256 and required tokens.
- Executor tests show ESC/POS uses the shared counts/copies/serial/log/cancel semantics.
- Existing TSPL/ZPL/CPCL tests remain green; fast suite < 2 minutes.

## Manual Hardware Validation

Use `verification/hardware-matrix.md`. Minimum checklist:

- [ ] Epson-compatible 80 mm/203 dpi: text, Code128, QR, image, full cut.
- [ ] 58 mm/203 dpi device: printable-width validation and image clipping.
- [ ] Code page: ASCII + Chinese (CJK code page) or raster fallback.
- [ ] PDF417/DataMatrix native or raster fallback.
- [ ] Cash drawer pin 2 and pin 5 (if hardware present).
- [ ] Unsupported cut/drawer model: warning, content still prints.
- [ ] RFID document: rejected with a clear error.
- [ ] Test print: one label, no log, no serial advance.
- [ ] TCP/USB/file transport: same result semantics as 003.

## Explicitly Not Automated

- Firmware-specific 2D/cut/drawer behavior and print quality.
- Code-page availability on every model.
- Cash drawer electrical behavior.
- Cross-platform transports (owned by 005).

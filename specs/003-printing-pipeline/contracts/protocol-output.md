# Contract: Protocol Output

**Feature**: `003-printing-pipeline` | **Date**: 2026-10-18

## Common Rules

- Consume `ResolvedPrintScene` / `PrintPlan`; never re-resolve sources.
- Convert millimetres to dots with 203/300/600 dpi (`dpi / 25.4`).
- Encoding: `utf8` or `gbk` (GB18030).
- Preamble once per job; postamble once; native batches of at most 24 pages.
- When a feature cannot be expressed faithfully, emit a page bitmap; if unavailable,
  block the send.

## TSPL

- `SIZE <w> mm,<h> mm`, `DENSITY`, `SPEED`, one `CLS` per physical page.
- Media: `GAP`/`BLINE` by label type; `REFERENCE` top offset; `CUT`/`BACKFEED` by media
  settings.
- `BARCODE`, `QRCODE`, `DMATRIX`, `PDF417`, `BOX`, `LINE`, `TEXT`, `BITMAP`.
- RFID: `RFID;EPC,...` and `RFID;LOCK,...`.
- `PRINT 1,<copies>`.

## ZPL

- `^XA`/`^XZ`; `^PW`, `^LL`, `^PQ`.
- `^MTD` (thermal) / `^MTT` (transfer).
- `^BC`, `^BA`, `^BQ`, `^BX`, `^B7`, `^GB`, `^FO`, `^FD`, `^FH` escaping.
- `^GFA` for images/ Chinese raster fallback; `^AA` built-in font.
- RFID: `^RFW`, `^RFS`, `^RLM`.

## CPCL

- Header `! 0 200 200 <pageHeightUnits> <copies>`; `PAGE-WIDTH`, `GAP-SENSE`.
- `BOX`, `LINE`, `BARCODE 128`, `BARCODE QR … ENDQR`, `PDF-417 … ENDPDF`,
  `DATAMATRIX … ENDDATAMATRIX`, `EG`, `FORM`, `PRINT`.
- No non-standard `ELLIPSE`.

## Goldens

`app/fixtures/protocol/*.prn` are compared by byte length, SHA-256 and required tokens.
`.gitattributes` marks them `-text`; update only through `npm run fixtures:print`.

Evidence: `app/src/shared/print/tspl.ts`, `zpl.ts`, `cpcl.ts`, `engine.ts`,
`tests/unit/shared/print/tspl.test.ts`, `zpl.test.ts`, `cpcl.test.ts`,
`tests/contracts/protocol-golden.test.ts`.

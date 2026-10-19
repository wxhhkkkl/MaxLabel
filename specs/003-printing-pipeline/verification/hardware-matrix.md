# Printing Pipeline — Manual Hardware Matrix

**Feature**: `003-printing-pipeline` | **Date**: 2026-10-18

Use this template for release/real-device verification. Automated tests do not replace
physical print quality, scan grade or firmware behavior.

## Device / Transport Matrix

| Date | Brand | Model | Firmware | Protocol | Port | DPI | Encoding | Result | Notes |
|------|-------|-------|----------|----------|------|-----|----------|--------|-------|
| 2026-10-19 | Zenpert | 4T530 | not recorded | TSPL | USB001 (Windows spooler RAW) | 300 | UTF-8 (ASCII content) | partial | Code128/QR/PDF417/BOX/BAR pass; TEXT font 0, LINE and BITMAP polarity defects below |
|      |       |       |          | TSPL/ZPL/CPCL | driver/file/TCP/COM/USB/BT/LPT | 203/300/600 | UTF-8/GBK | pass/fail | |

## TSPL Findings (2026-10-19, Zenpert 4T530)

Verified over USB001 with raw TSPL on 60×40 mm gap labels, 300 dpi:

- Pass: Code128, QR, PDF417, `BOX`, `BAR`, and `TEXT` with numeric fonts `"1"`/`"2"`.
- Fail: the app's default `TEXT` uses font `"0"` with the multiplier parameters set to
  `1,2`. In TSPL2 font `"0"` is a TrueType font whose width/height parameters are point
  sizes, so the output is effectively invisible. The app's `printerFont` values
  `Font0`–`Font8` are also not valid TSPL font names.
- Fail: the app emits `LINE` for line objects and table borders. TSPL2's drawing
  commands are `BAR`/`BOX`; the printer ignores `LINE`, so lines and table borders do
  not print.
- Fail: the app sends `MonoBitmap` bytes (1 = black) directly in `BITMAP`. TSPL expects
  0 = black and 1 = white, so images and Chinese/fallback bitmaps print inverted; an
  all-black bitmap (all `0xFF`) prints as blank.
- Evidence: corrected raw syntax `TEXT ...,"0",0,24,24`, `BAR ...`, and an all-`0x00`
  `BITMAP` all printed. Local diagnostic payloads are under
  `app/release/hardware-probe/` (gitignored).

No product code was changed. Remaining checks were not run: driver test print, settings
persistence, 25-label batch, cancel/disconnect, ZPL/CPCL, DataMatrix, RFID. ESC/POS is
not applicable to this TSPL device; macOS/Linux checks require other machines.

## Label Content Checklist

- [ ] Text (including Chinese) — native TSPL font 0 output invisible; see findings
- [x] Code128
- [x] QR
- [x] DataMatrix / PDF417 — PDF417 verified; DataMatrix not tested
- [ ] Image / bitmap fallback — TSPL BITMAP polarity inverted; see findings
- [ ] Table grid — TSPL LINE ignored; see findings
- [ ] Ellipse warning (native) or bitmap fallback
- [ ] RFID EPC write + lock (firmware-dependent) — device has no RFID
- [ ] Printer built-in font — numeric fonts 1/2 pass; font 0 sizing wrong

## Operational Checks

- [ ] Driver print: one system job, correct count × copies/page order.
- [ ] 25-label TCP batch: 24 + 1 batches; disconnect second batch → `partial`, sent 24.
- [ ] USB queue incomplete/unknown → `unknown`, no serial advance.
- [ ] Paper out / ribbon out / cover open → task does not report success.
- [ ] Cancel during send → `canceled`; later jobs unaffected.
- [ ] Invalid LPT/COM/TCP/USB config rejected with a clear message.
- [ ] Serial numbers only advance for confirmed output and write back after restart.

## Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Verifier |  |  |  |
| Owner |  |  |  |

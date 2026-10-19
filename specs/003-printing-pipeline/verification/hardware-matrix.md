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
- Fixed and re-verified: the TSPL builder now maps `Font0`–`Font8` to numeric TSPL
  names and uses point sizes for TrueType font `"0"`. The app-generated label prints
  `TEXT ... "0",0,9,9 ...` correctly.
- Fixed and re-verified: line objects and table grids emit `BAR` for horizontal and
  vertical segments; diagonal lines require the page-bitmap fallback.
- Fixed and re-verified: `BITMAP` data is inverted before sending (TSPL expects
  0 = black, 1 = white), so images and Chinese/fallback bitmaps print correctly.
- Orientation: `DIRECTION 1` prints in the expected orientation.
- Evidence: corrected raw syntax `TEXT ...,"0",0,24,24`, `BAR ...`, and an all-`0x00`
  `BITMAP` all printed. After the fix, the app-generated label printed the text,
  Code128, QR, PDF417, black image block and bottom line with the correct orientation.
  Local payloads are under `app/release/hardware-probe/` (gitignored).

The three defects are fixed in the TSPL builder and covered by unit/contract tests.
Remaining checks were not run: driver test print, settings persistence, 25-label batch,
cancel/disconnect, ZPL/CPCL, DataMatrix, RFID. ESC/POS is not applicable to this TSPL
device; macOS/Linux checks require other machines.

## Label Content Checklist

- [x] Text (English native font 0 verified; Chinese bitmap path not separately printed)
- [x] Code128
- [x] QR
- [x] DataMatrix / PDF417 — PDF417 verified; DataMatrix not tested
- [x] Image / bitmap fallback
- [ ] Table grid — uses the verified `BAR` path; a table was not printed separately
- [ ] Ellipse warning (native) or bitmap fallback
- [ ] RFID EPC write + lock (firmware-dependent) — device has no RFID
- [x] Printer built-in font — font 0 printed; `Font1`–`Font8` mapping is unit-tested

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

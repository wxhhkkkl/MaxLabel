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

## USB / Driver Checks (2026-10-19, Zenpert 4T530)

Command mode (USB001 raw):

- 25-label batch: status `已发送 · 25 张`; log `submitted`, `sentCount: 25`. The physical
  labels show text, Code128, the ellipse (page-bitmap fallback) and the 2×2 table.
- Serial writeback: one label printed with 「打印后更新变量数据」 advanced
  `SN-1001 → SN-1002` and saved the template.
- Cancel: a 20-label batch was canceled; the log records `canceled`, `sentCount: 0`.
  The printer still fed 1–5 labels because the first spooler batch cannot be recalled.
  The UI status no longer sticks at 「正在取消当前操作…」; it now ends at
  「已取消打印（已发送 0 张）」.
- Settings persistence: speed/density and the USB port survived template save/reopen;
  the 「保存为默认」 preference persisted in localStorage.
- Defects found and fixed: `normalizePrinter` dropped `usbPort` and the serial framing
  fields (USB printing failed with 「USB 打印机端口无效」); the cancel terminal status
  was suppressed by the stale-operation guard.

Driver mode:

- The native print dialog was invisible because it was parented by a `show: false`
  BrowserWindow; `showInactive()` makes the dialog visible.
- The test print submitted (`驱动打印任务已提交（1 张）`), wrote no print log and did not
  advance the serial.
- Physical output is still wrong: three labels were fed, content landed on the last two,
  and the result was landscape. The driver default paper is 4×6 in while the label is
  60×40 mm; the driver paper size is being changed and the physical check will be
  repeated.

Remaining: driver paper-size retest, TCP 25-label disconnect (no LAN), RFID (no RFID),
ZPL/CPCL, DataMatrix, and macOS/Linux checks. ESC/POS is not applicable to this TSPL
device.

## Label Content Checklist

- [x] Text (English native font 0 verified; Chinese bitmap path not separately printed)
- [x] Code128
- [x] QR
- [x] DataMatrix / PDF417 — PDF417 verified; DataMatrix not tested
- [x] Image / bitmap fallback
- [x] Table grid — printed through the page-bitmap fallback
- [x] Ellipse warning (native) or bitmap fallback — ellipse printed via the page bitmap
- [ ] RFID EPC write + lock (firmware-dependent) — device has no RFID
- [x] Printer built-in font — font 0 printed; `Font1`–`Font8` mapping is unit-tested

## Operational Checks

- [ ] Driver print: one system job, correct count × copies/page order — dialog/log/serial
  verified; page size alignment pending the 60×40 mm driver paper setting.
- [ ] 25-label TCP batch: 24 + 1 batches; disconnect second batch → `partial`, sent 24 —
  USB 25-label batch verified; TCP disconnect unavailable on this USB-only device.
- [ ] USB queue incomplete/unknown → `unknown`, no serial advance.
- [ ] Paper out / ribbon out / cover open → task does not report success.
- [x] Cancel during send → `canceled`; later jobs unaffected — log `canceled`,
  `sentCount: 0`; the spooler still fed 1–5 labels.
- [ ] Invalid LPT/COM/TCP/USB config rejected with a clear message.
- [x] Serial numbers only advance for confirmed output and write back after restart —
  `SN-1001 → SN-1002` with 「打印后更新变量数据」.

## Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Verifier |  |  |  |
| Owner |  |  |  |

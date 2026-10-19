# Printing Pipeline — Manual Hardware Matrix

**Feature**: `003-printing-pipeline` | **Date**: 2026-10-18

Use this template for release/real-device verification. Automated tests do not replace
physical print quality, scan grade or firmware behavior.

## Device / Transport Matrix

| Date | Brand | Model | Firmware | Protocol | Port | DPI | Encoding | Result | Notes |
|------|-------|-------|----------|----------|------|-----|----------|--------|-------|
|      |       |       |          | TSPL/ZPL/CPCL | driver/file/TCP/COM/USB/BT/LPT | 203/300/600 | UTF-8/GBK | pass/fail | |

## Label Content Checklist

- [ ] Text (including Chinese)
- [ ] Code128
- [ ] QR
- [ ] DataMatrix / PDF417
- [ ] Image / bitmap fallback
- [ ] Table grid
- [ ] Ellipse warning (native) or bitmap fallback
- [ ] RFID EPC write + lock (firmware-dependent)
- [ ] Printer built-in font

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

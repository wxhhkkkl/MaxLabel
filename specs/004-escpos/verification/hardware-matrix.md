# ESC/POS Hardware Matrix

**Feature**: `004-escpos` | **Status**: template, filled during planning/implementation

> 2026-10-19: the only installed hardware is a Zenpert 4T530 (TSPL-EZD label printer,
> USB001), not an ESC/POS 58/80 mm device. This matrix was not exercised.

| Date | Brand | Model | Firmware | Paper | DPI | Code page | Text | 1D | QR | PDF417 | DataMatrix | Image | Cut | Drawer | Result | Notes |
|------|-------|-------|----------|-------|-----|-----------|------|----|----|--------|------------|-------|-----|--------|--------|-------|
|      |       |       |          | 58/80 mm | 203/300 |          |      |    |    |        |            |       |     |        |        |       |

## Checklist

- [ ] Initialization and code-page selection
- [ ] Text styles: alignment, size, bold, underline, reverse, line spacing
- [ ] 1D barcodes (Code128, EAN/UPC, Code39, ITF)
- [ ] QR native command
- [ ] PDF417 / DataMatrix native or raster fallback
- [ ] Monochrome image / GS v 0 width limits
- [ ] Full/partial cut
- [ ] Cash drawer pin 2/5
- [ ] Test print / log / serial semantics
- [ ] Unsupported feature fallback or block

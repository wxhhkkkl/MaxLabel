# Contract: ESC/POS Output

**Feature**: `004-escpos` | **Date**: 2026-10-19

## Builder Inputs

- `ResolvedPrintScene` / `PrintPlan` (shared with 003).
- `PrinterConfig` with `driver: 'escpos'` and ESC/POS fields.
- `EscPosProfile` selected by config/profile id.

## Output

A `CommandPayload`:
- `segments`: ASCII command text plus binary raster/code-page data.
- `encoding`: transport hint; pre-encoded binary segments must not be re-encoded.
- `port`: unchanged.

## Command Sequence

1. Initialize: `ESC @`.
2. Select code page: `ESC t n` (when text uses a code page).
3. For each primitive in the resolved scene:
   - Text: alignment (`ESC a n`), size (`GS ! n`), bold (`ESC E n`), underline
     (`ESC - n`), reverse (`GS B n`), encoded text, line spacing (`ESC 3 n`/`ESC 2`).
   - 1D barcode: `GS k` with the profile's symbology mapping; unsupported → raster.
   - 2D barcode: `GS ( k` family when profile-supported; otherwise raster.
   - Image: `GS v 0` monochrome raster; width ≤ printable dots.
   - Shapes/tables/ellipses/rotation/complex colour: raster fallback.
   - RFID: reject the job with "ESC/POS 不支持 RFID 写入" (no silent skip).
4. Feed: `ESC d n` per config.
5. Cut: `GS V m` (full/partial) when supported and configured.
6. Cash drawer: `ESC p m t1 t2` (pin 2/5) when supported and configured.

## Fallback Rules

- A primitive that cannot be expressed faithfully forces a page/object raster. If the
  raster is not ready, the executor blocks sending.
- Unsupported cut/drawer commands warn and continue content.
- 58 mm/300 dpi profiles must validate raster width against `printableDots`; overflow is
  rejected before allocation.

## Compatibility

- Scene/plan/transport/log/cancel semantics are identical to 003.
- Existing TSPL/ZPL/CPCL output must not change.

## Test Contract

- Unit tests assert command bytes/order for text, 1D, QR, raster, cut, drawer.
- Golden test compares one ESC/POS fixture by bytes/SHA-256/tokens.
- Integration tests assert the executor sends an ESC/POS payload through the existing
  transport with unchanged counts/copies/serials.

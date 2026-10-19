# Data Model: ESC/POS Command Support

**Feature**: `004-escpos` | **Date**: 2026-10-19

This model extends the existing print entities; it does not change the scene/plan model.

## CommandSet

Extend the existing union:

```text
'tspl' | 'zpl' | 'cpcl' | 'escpos'
```

`PrinterConfig.driver` selects the builder. Existing documents without `escpos` are
unchanged.

## PrinterConfig Additions

| Field | Type | Meaning |
|-------|------|---------|
| `escposProfile?` | string | Profile id from the ESC/POS profile registry |
| `escposPaperWidthMm?` | `58 \| 80` | Paper width |
| `escposCodePage?` | string | Code page id (e.g., `CP437`, `CP936`) |
| `escposCut?` | `none \| full \| partial` | Cut after content |
| `escposDrawer?` | `none \| pin2 \| pin5` | Cash-drawer trigger |
| `escposFeedLines?` | number | Feed lines before cut/drawer |

`dpi` and port/encoding remain the existing fields. Defaults are conservative: no cut,
no drawer, profile default code page.

## EscPosProfile

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Stable profile id |
| `brand` / `model` | string | Display/model info |
| `paperWidthMm` | 58 / 80 | Paper width |
| `dpi` | 203 / 300 | Print resolution |
| `printableDots` | number | Printable width in dots |
| `codePages` | string[] | Supported code pages |
| `defaultCodePage` | string | Default code page |
| `supports1D` | boolean | Native 1D barcode commands |
| `supportsQR` | boolean | Native QR |
| `supportsPDF417` | boolean | Native PDF417 |
| `supportsDataMatrix` | boolean | Native DataMatrix |
| `supportsCut` | `none \| full \| partial` | Cutter capability |
| `supportsDrawer` | boolean | Cash drawer |
| `notes` | string | Firmware caveats |

Unknown models use a `generic` profile: 80 mm/203 dpi, CP437, 1D + raster, no native 2D,
no cut/drawer unless configured and confirmed.

## EscPosOutput

The builder returns the existing `CommandPayload`:

- `segments`: text segments (ESC/POS command strings) and binary segments (raster data).
- `encoding`: `utf8`/`gbk` used by the transport layer; ESC/POS text is encoded with the
  profile's code page (the transport must not re-encode text segments).
- `port`: unchanged.

If code-page encoding is required, the builder emits a binary segment already encoded to
the selected code page; text segments are ASCII command text only.

## Primitive Mapping

| Resolved primitive | ESC/POS output |
|--------------------|----------------|
| text (ASCII/code page) | `ESC a`, `GS !`, `ESC E`, `ESC -`, `GS B`, encoded text |
| text (unsupported chars) | page/object raster fallback |
| barcode (supported) | `GS k` with profile symbology mapping |
| barcode (unsupported) | raster fallback |
| QR/PDF417/DataMatrix (supported) | `GS ( k` 2D commands |
| QR/PDF417/DataMatrix (unsupported) | raster fallback |
| image | `GS v 0` mono raster; validate printable width |
| rect/line/table/ellipse | raster fallback (no native vector commands) |
| RFID | not supported by ESC/POS; reject the job with a clear error rather than silently skipping the write |

## Control Commands

| Feature | Command family |
|---------|----------------|
| Initialize | `ESC @` |
| Code page | `ESC t n` |
| Alignment | `ESC a n` |
| Text size | `GS ! n` |
| Bold / underline / reverse | `ESC E n`, `ESC - n`, `GS B n` |
| Line spacing / feed | `ESC 3 n` / `ESC 2`, `ESC d n` |
| Cut | `GS V m` |
| Cash drawer | `ESC p m t1 t2` |

Exact bytes and unsupported-command handling are defined in
`contracts/escpos-output.md`.

## Invariants

- The builder consumes resolved primitives; it never resolves data sources.
- Counts/copies/serials/log/cancel are owned by `PrintPlan`/executor (003).
- Raster width never exceeds the profile's printable dots.
- Unsupported visual features fall back to raster; if the bitmap is missing, block send.
- Unsupported control commands warn and do not abort content.
- RFID with ESC/POS is rejected with a clear message (no silent data loss).

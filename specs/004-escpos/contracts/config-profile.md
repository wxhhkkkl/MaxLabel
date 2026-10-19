# Contract: ESC/POS Configuration and Profiles

**Feature**: `004-escpos` | **Date**: 2026-10-19

## PrinterConfig Fields

| Field | Values | Default |
|-------|--------|---------|
| `driver` | `escpos` | — |
| `dpi` | 203 / 300 | profile |
| `escposProfile` | profile id | `generic` |
| `escposPaperWidthMm` | 58 / 80 | profile |
| `escposCodePage` | code page id | profile default |
| `escposCut` | `none`/`full`/`partial` | `none` |
| `escposDrawer` | `none`/`pin2`/`pin5` | `none` |
| `escposFeedLines` | 0–10 | 0 |

## Profile Registry

- Known Epson-compatible models: paper width, DPI, printable dots, code pages, 1D/2D
  support, cut/drawer support.
- `generic`: 80 mm/203 dpi, CP437, 1D + raster, no native 2D, no cut/drawer.
- Unknown models use `generic` and display a warning.
- Profiles are data, not branch logic; the builder asks the profile for capabilities.

## Validation

- `driver` must be one of `tspl`/`zpl`/`cpcl`/`escpos`.
- Paper width only 58/80; DPI only 203/300.
- Code page must be in the profile's supported list.
- Cut/drawer values must be in the allowlist; unsupported combinations warn.
- Raster width ≤ `printableDots`; oversized raster rejected.
- All new fields persist with the template and survive open/normalize.

## UI

- Command-set selector includes ESC/POS.
- ESC/POS panel exposes paper width, DPI, code page, cut, drawer and feed.
- Selecting ESC/POS updates available options from the profile; unknown profile shows a
  conservative default warning.
- Settings round-trip through template save/open.

## Tests

- Config validation/round-trip unit tests.
- Profile selection and unknown-profile behavior tests.
- UI smoke/E2E for selecting ESC/POS and saving/reopening (where feasible).

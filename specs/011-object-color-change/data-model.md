# Data Model: Object Colour Change and Colour Index Table (As-Is)

**Feature**: `011-object-color-change` | **Date**: 2026-10-20

## Enumerations

```ts
type ColorChangeMode = 'fixed' | 'random' | 'indexByContent' | 'indexVar'
  | 'valueVar' | 'index' | 'rgb'

type ColorChangeGranularity = 'solid' | 'char' | 'block' | 'gradient'
```

Granularity by object type (`GRANULARITY_BY_TYPE`):

| Type | Allowed |
|------|---------|
| text | solid, char |
| barcode | solid, block, gradient |
| line / rect / ellipse / image | solid |
| table / rfid / group | none (no variable colour) |

## ColorChangeConfig

| Field | Type | Rules |
|-------|------|-------|
| `mode` | ColorChangeMode | default `fixed`; legacy `variable` → `valueVar`; unknown → `fixed` |
| `tableSource` | `'shared' \| 'private'` | default `private` |
| `privateTable` | string[] | ≤256 entries, each ≤64 chars (out-of-range → document error); empty → predefined table |
| `changeMode` | ColorChangeGranularity | `char`/`block`/`gradient` kept only if allowed; otherwise `solid` |
| `blockRows` / `blockCols` | number | integer 1–100, default 1; out-of-range → document error |
| `variableName` | string | ≤255 chars; used by `indexVar`/`valueVar` |
| `inputValue` | string? | ≤255 chars; used by `index`/`rgb` |

## ColorChangePlan

| Field | Type | Meaning |
|-------|------|---------|
| `kind` | `solid` \| `chars` \| `block` \| `gradient` | Chosen by the effective granularity |
| `colors` | string[] | One colour for solid, per character for chars, per block for block/gradient |
| `rows` / `cols` | number | 1/1 for solid/chars; block grid dimensions otherwise |

## Colour index table

| Field | Type | Rules |
|-------|------|-------|
| Source | shared (`LabelDoc.colorIndexTable`) or private (`colorChange.privateTable`) | selected by `tableSource` |
| Default | 10 colours: `#000000,#FF0000,#00FF00,#0000FF,#FFFF00,#FF00FF,#00FFFF,#808080,#FF8000,#8000FF` | used when the selected table is empty |
| Indexing | `index mod table.length` | wraps in both directions |
| Parsing | `split(/[,|]/)`, trim, drop empties | `valueVar`/`rgb` lists |
| Character index | digits → value; letters → `\|code − 'A'\| mod 10`; others → `code mod 10` | content/index variables |

## Resolution rules

Inputs: object type, mode, content string (resolved text/barcode value), named variable,
input value, private/shared tables, label context.

| Mode | Primary data | Empty fallback |
|------|--------------|----------------|
| `fixed` | object colour | — |
| `random` | content length for positions; seeded hash per position | one colour from the table |
| `indexByContent` | content characters (text/barcode); other types use index 0 | index 0 colour |
| `indexVar` | `variableName` value characters | object colour |
| `valueVar` | `parseColorValues(variableName value)` | object colour |
| `index` | `inputValue` characters | object colour |
| `rgb` | `parseColorValues(inputValue)` | object colour |

Effective granularity → plan:

- **solid**: one colour from the first unit; unsupported/empty → object colour.
- **char**: `values.length` colours, or one per character (minimum 1).
- **block**: `blockRows × blockCols` colours, unit colour per cell.
- **gradient**: first = unit colour 0, last = unit colour `unit − 1`; interpolate RGB per
  cell (invalid hex falls back to the endpoint).

Random colours use `labelSeed(labelIndex, copy, recordIndex)` and the character/block
position; the same inputs must resolve identically in preview and output.

## Normalisation (document.ts)

| Field | Rule |
|-------|------|
| `mode` | `variable` → `valueVar`; unknown/absent → `fixed` |
| `tableSource` | only `shared`; anything else → `private` |
| `changeMode` | only `char`/`block`/`gradient`; otherwise `solid` |
| `privateTable` | array ≤256, strings ≤64; non-array → `[]` |
| `blockRows` / `blockCols` | finite, integer 1–100 (default 1) |
| `variableName` / `inputValue` | bounded strings ≤255 |
| `LabelDoc.colorIndexTable` | ≤256 colour strings; invalid → document error |

## Storage

- `LabelObject.colorChange` is saved with the object in `.msdx`.
- `LabelDoc.colorIndexTable` is saved with the template; it is the shared table.
- The private table lives inside the object's `colorChange`.
- No new fields or template-version change.

## Capability integration

| Context | Behaviour |
|---------|-----------|
| Editor / preview | Fabric fills and tinted barcodes/images |
| Driver print | Colour output supported; vector pages fall back to raster for block/gradient barcodes |
| Native commands (TSPL/ZPL/CPCL/ESC/POS) | Any dynamic colour must force page rasterisation; barcode raster trigger requires verification (D-008) |
| Property page | `printerSupportsColor` disables colour controls for native ports; image controls also require `imageColorAllowed` |

## Consumers

```text
ColorChangeConfig + content + tables + DataCtx
        │
        ▼
resolveColorChangePlan ──► ColorChangePlan
        │
        ├── fabricObjects (text/rect/ellipse fills, barcode tint, image mono tint)
        ├── bitmap/page rendering
        └── resolveObjectColor (single representative colour)
```

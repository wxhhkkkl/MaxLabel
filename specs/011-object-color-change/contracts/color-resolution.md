# Contract: Colour Resolution

**Feature**: `011-object-color-change` | **Date**: 2026-10-20

## Entry point

```ts
resolveColorChangePlan(
  obj: { type: ObjType; colorChange?: ColorChangeConfig },
  ctx: DataCtx | undefined,
  fallback: string,
  sharedTable?: string[],
  content?: string
): ColorChangePlan
```

`resolveObjectColor(...)` is a thin compatibility wrapper returning `colors[0]`.

## Output invariants

| `kind` | `colors` | `rows` / `cols` |
|--------|----------|-----------------|
| `solid` | exactly 1 | 1 / 1 |
| `chars` | one per character/value (minimum 1) | 1 / length |
| `block` | `blockRows × blockCols` | configured |
| `gradient` | `blockRows × blockCols` interpolated | configured |

Every returned colour is a string; callers use it directly as a Fabric fill or tint. The
resolver never mutates the object, context or tables.

## Mode behaviour

| Mode | Reads | Falls back to the object colour when |
|------|-------|--------------------------------------|
| `fixed` | — | always returns `[fallback]` |
| `random` | content length | never (uses the table even for empty content) |
| `indexByContent` | `content` (text/barcode); other types use index 0 | non-text/barcode has no content → index 0 |
| `indexVar` | named variable characters | variable missing/empty |
| `valueVar` | named variable split into colours | variable missing/empty |
| `index` | `inputValue` characters | input empty |
| `rgb` | `inputValue` split into colours | input empty/invalid |

Named variables resolve from `keyboardValues` first, then the active dataset row by column
name.

## Granularity

- The requested granularity is applied only if allowed for the object type; otherwise
  `solid`.
- `solid` takes the first unit colour (or `fallback` when no unit exists).
- `char` uses one unit per colour value, or one per character (minimum 1).
- `block`/`gradient` use `max(1, blockRows|blockCols)` and never exceed the normalised
  1–100 range.
- Gradient interpolates the first and last unit colours in RGB; invalid hex returns the
  nearer endpoint.

## Determinism

Random colours are a pure function of label index, copy, record index and position. The
same inputs must return the same colours across the editor preview, bitmap rendering and
native fallback in one run. Cross-version stability is `TODO(待确认)`.

## Consumers

- `renderer/src/rendering/fabricObjects.ts` — text/rect/ellipse fills, barcode tint,
  image mono tint.
- `renderer/src/print/*` — page/raster rendering.
- Print capability path — decides when native commands must rasterise instead.

## Non-goals

- Adding modes, granularities or object types.
- Changing the default colour table.
- Validating hex values inside the resolver (renderers fall back on invalid colours).

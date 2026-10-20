# Contract: Colour Index Tables

**Feature**: `011-object-color-change` | **Date**: 2026-10-20

## Sources

| `tableSource` | Data | Owner |
|---------------|------|-------|
| `private` | `colorChange.privateTable` | object |
| `shared` | `LabelDoc.colorIndexTable` | document |

Selection:

```ts
const table = tableSource === 'shared' ? sharedTable : privateTable
return table && table.length ? table : DEFAULT_COLOR_INDEX_TABLE
```

An empty or missing selected table always falls back to the ten predefined colours.

## Default table

```text
0 #000000   1 #FF0000   2 #00FF00   3 #0000FF   4 #FFFF00
5 #FF00FF   6 #00FFFF   7 #808080   8 #FF8000   9 #8000FF
```

## Index lookup

- Numeric index (from `index`, `indexVar`, `indexByContent`): `index mod table.length`
  with wrap-around for negative indexes.
- Character index: digits 0–9 → value; A–Z/a–z → `|code − 'A'| mod 10`; others →
  `code mod 10`.
- Colour-value modes (`rgb`, `valueVar`) do not use the table; they use the parsed values.

## Parsing

`parseColorValues(text)`:

1. Split on `,` or `|`.
2. Trim each part.
3. Drop empty parts.
4. Return the remaining strings in order.

An empty result falls back to the object colour.

## Validation and limits

| Location | Rule |
|----------|------|
| `privateTable` | ≤256 entries, each ≤64 chars |
| `LabelDoc.colorIndexTable` | ≤256 colour strings; invalid colour → document error |
| Input/variable values | ≤255 chars |
| Table index | wraps; never throws |

## UI contract

- `ObjectPropsDialog` exposes the source selector and either the private or shared table
  editor.
- The shared editor writes `LabelDoc.colorIndexTable` (via the document patch callback);
  the private editor writes `colorChange.privateTable`.
- Empty tables show the "predefined index 0–9" hint and behave as the default table.
- Colour controls are hidden/disabled when the printer or image does not support variable
  colour; the mode selector still shows the current value.

## Non-goals

- Adding/removing predefined colours.
- Persisting tables outside the object/document.
- Changing the index formula.

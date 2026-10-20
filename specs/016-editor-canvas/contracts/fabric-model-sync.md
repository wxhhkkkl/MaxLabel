# Contract: Fabric ↔ Model Synchronisation

**Feature**: `016-editor-canvas` | **Date**: 2026-10-20

## Trigger

`syncFromFabric(object, fabricObject, scale)` runs once on Fabric `object:modified` (end of a
drag/resize/rotate). It returns a new model object; the canvas adapter then calls `onSync`
with the updated object array. No per-frame model writes.

## Model box vs render box

- For rect/ellipse/line/table/image, the Fabric box is the model box.
- Text renders at its natural glyph width; barcode renders at a scaled content size. Their
  Fabric box is converted back to the model frame using the alignment:
  - text: `align` (left/center/right) and `verticalAlign` (top/middle/bottom);
  - barcode: `barcodeAlign` (left/center/right, vertical middle);
  - default: left/top.
- When the render-box scale is unchanged since creation (`dataBoxScaleX/Y`), a pure
  move/rotate keeps the model `w/h`. A real resize recomputes the size from the render box.
- Stroke width participates in the visual anchor but not in the model width/height.

## Groups

- Group children are synced in the group's local coordinate space via the Fabric transform
  matrix inverse.
- Moving/rotating a group must preserve each child's `w/h` unless its own scale changed.
- Nested groups use the same local-matrix rule.

## Resize constraints

```ts
constrainFabricResize({ object, baseWidthPx, baseHeightPx, scaleX, scaleY, corner, shiftKey, pixelsPerMm })
```

| Object | Rule |
|--------|------|
| barcode | snap both dimensions to 0.1 mm, minimum 0.5 mm |
| printer-font text | same output step as barcode |
| rect/ellipse/line/table + Shift | equal width/height (maximum side) |
| text, corner handle | preserve the model width/height ratio |
| text, edge handle | allow independent stretching |
| all | absolute dimensions ≥ 0.5 mm; negative drag direction preserved |

The function returns adjusted `scaleX/scaleY` (Fabric) and the resulting `widthMm/heightMm`.

## Tolerance

Group geometry round-trips within 0.02 mm (existing `editor-geometry` test). Values are
rounded with `round2` where the model stores them.

## Non-goals

- Changing Fabric constraints beyond the documented rules.
- Persisting Fabric-specific fields.

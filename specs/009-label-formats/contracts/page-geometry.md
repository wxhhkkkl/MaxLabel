# Contract: Page and Paper Geometry

**Feature**: `009-label-formats` | **Date**: 2026-10-20

## Ownership

`app/src/shared/domain/paper.ts` is the single source of physical paper geometry;
`app/src/renderer/src/dialogs/paperHoleFields.ts` owns the UI option mapping. Editor,
preview and print MUST consume these helpers rather than re-deriving shapes.

## Shapes

| UI option | Internal value | Path |
|-----------|----------------|------|
| 方角矩形 | `rect` | rectangle |
| 圆角矩形 | `roundRect` | rectangle with corner radius (default ≈1 mm) |
| 圆形 | `ellipse` | ellipse (`disc` is normalized to ellipse + center hole) |

`paperPath(width, height, paper)` returns an SVG path; the hole cutout is added with the
even-odd fill rule.

## Holes

| Selection | `innerShape` | Size meaning | Drawn when |
|-----------|--------------|--------------|------------|
| 无 | absent | box disabled | never |
| 圆洞 | `circle` | diameter | size > 0 |
| 矩形 | `rectangle` | side length | size > 0 |

Rules:

- The hole is always centered.
- Size is clamped to `0 .. min(width, height) − 0.02` mm.
- Missing `innerShape` means circle (legacy templates).
- Switching from rectangle to none clears the drawn hole but preserves the user’s typed
  value only if the caller re-supplies it; the dialog shows an empty/disabled box for none.

## Page size fallback

When the page width/height is missing, zero, or non-finite:

```text
pageWidth  = max(0.1, labelWidth  * cols + colGap  * (cols - 1) + 4)
pageHeight = max(0.1, labelHeight * rows + rowGap * (rows - 1) + 4)
```

## Label colour

- Normalized to lowercase `#rrggbb`; invalid values become `#ffffff`.
- Stored as `layout.labelColor` but only used by the editor/preview; it is never emitted as
  a background colour in printer commands.

## Preview annotations

- `previewScale = min(boxWidth / viewBoxWidth, boxHeight / viewBoxHeight)`.
- `fontPx = clamp(labelHeightMm × previewScale × 0.12, 9, 17)`.
- `fontViewBox = fontPx / previewScale`.
- The sequence number is centred in each label cell; dimension text and lines use the same
  font size and a 2.2× font margin.

## Validation (document normalization)

| Field | Rule |
|-------|------|
| `rows`, `cols` | integer 1–100 |
| `pageWidthMm`, `pageHeightMm` | 0.1–10000 when present |
| `pagesPerBox` | integer 1–100000 when ≥1; otherwise dropped |
| `cornerRadiusMm` | 0..min(width, height)/2 |
| `innerDiameterMm` | 0..min(width, height)−0.02 |
| `innerShape` | `circle` or `rectangle` |
| `labelColor` | `#rrggbb` only |
| `formatKind` | `preset` or `custom` |

## Non-goals

- Changing the SVG path algorithm or hole defaults.
- Adding a new shape/hole enum or migrating existing templates.
- Altering print-page geometry or the shared print plan.

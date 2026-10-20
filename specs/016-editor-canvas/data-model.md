# Data Model: Editor Canvas Interaction (As-Is)

**Feature**: `016-editor-canvas` | **Date**: 2026-10-20

## CanvasPoint / CanvasRectLike

```ts
interface CanvasPoint { x: number; y: number }        // scene pixels, unrotated
interface CanvasRectLike { left: number; top: number; width: number; height: number }
```

`eventClientPoint(event)` normalises pointer input to client coordinates (prefers
`clientX/Y`; falls back to `pageX/Y − scroll` when a synthetic event reports `0,0`).

`clientToCanvasPoint(client, bounds, sceneW, sceneH, zoom, rotation)` returns the scene point
after subtracting the viewport centre, applying the inverse rotation and dividing by zoom.
Zoom is clamped to ≥0.01 inside the transform.

## FitZoomInput

| Field | Type | Rule |
|-------|------|------|
| `mode` | `'w' \| 'h' \| 'win'` | fit width / height / both |
| `widthMm` / `heightMm` | number | document size |
| `rotation` | 0/90/180/270 | swaps the physical axes when 90/270 |
| `availableWidthPx` / `availableHeightPx` | number | viewport |
| `gutterPx` | number? | default 12 |

`available = max(1, viewport − 2 × gutter)`, `mmScale = 10`, fits are
`available / (mm × 10)`; `win` returns the minimum.

## Resize constraints

```ts
const LABELSHOP_RESIZE_STEP_MM = 0.1
const LABELSHOP_MIN_OBJECT_SIZE_MM = 0.5
```

```ts
interface FabricResizeInput {
  object: LabelObject
  baseWidthPx: number
  baseHeightPx: number
  scaleX: number
  scaleY: number
  corner: string        // tl/tr/bl/br or mt/mb/ml/mr
  shiftKey: boolean
  pixelsPerMm: number
}
interface FabricResizeOutput { scaleX: number; scaleY: number; widthMm: number; heightMm: number }
```

Rules:

- Barcode and printer-font text snap to 0.1 mm (minimum 0.5 mm).
- Rect/ellipse/line/table keep equal sides when Shift is held.
- Text corner handles keep the model width/height ratio; edge handles may stretch.
- Negative scales preserve the drag direction.

## Selection state

| Item | Source |
|------|--------|
| Active objects | Fabric `getActiveObjects()`, filtered to model IDs |
| Primary selection | `DocTab.selectedId` |
| Group child click | Model selection may differ from the Fabric group; the model wins when the child is inside the active group |
| Frame selection | `selectionBox` client rect; intersects rotation-aware object client bounds; a <3 px drag is ignored |

## Operation helpers

| Function | Input modes | Threshold |
|----------|-------------|-----------|
| `alignObjects` | left/right/top/bottom/midV/midH | ≥2 selected |
| `centerObjects` | h/v | ≥1 |
| `snapObjects` | top/left/right/bottom | ≥1 |
| `resizeObjects` | w/h/wh | ≥2 |
| `distributeObjects` | h/v | ≥3 |
| `rotateObjects` | 90/180/270 | ≥1 |
| `reorderObjects` | front/forward/backward/back | ≥1 |
| `groupObjects` / `ungroupObjects` | — | group ≥2; ungroup 1 group |
| `isPositionLocked` | — | locked objects are not moved |

## ClipboardPayload

```ts
interface ClipboardPayload {
  format: 'maxlabel-objects'
  version: 1
  objects: LabelObject[]
}
```

Read path:

1. Read system-clipboard text (if available), else the in-memory copy.
2. `JSON.parse`; accept either the envelope or a bare `objects` array.
3. Non-array/empty → `[]`.
4. Normalise through `normalizeDocument({ version: 2, name: 'Clipboard', widthMm: 10000, heightMm: 10000, objects })`.
5. Paste clones with fresh IDs and +1 mm offsets (recursively for groups).

## CreateObjectDefaults

```ts
interface CreateObjectDefaults { tableKeepSize?: boolean }
```

`createLabelObject(type, x, y, defaults)` returns `null` for unsupported types. Default
sizes/fields include text (40×8 mm, 4 pt), data (44×8), barcode (44×10, Code128), RFID
(44×10, EPC), table (44×24, 3×2, keepSize from defaults), line (30×0), diagonal (30×8),
image (24×16 placeholder) and rect/ellipse (40×8).

## Property tabs and geometry draft

`propertyTabsFor(type)`:

| Type | Tabs |
|------|------|
| text | 数据源、字体、文本、常规 |
| barcode | 数据源、条码、字体、常规 |
| rfid | 通用、RFID、数据 |
| image | 图片、常规 |
| table | 表格、常规 |
| rect/ellipse/line | 图形、常规 |
| other | 常规 |

`useObjectGeometryDraft` holds string drafts for x/y/w/h/rotation; `commit()` parses numbers,
falls back to the current model value and clamps width/height to ≥0.1.

## DocTab interaction state

`selectedId`, `zoom`, optional `zoomMode` (`manual`/`win`/`w`/`h`), `tool`, `recordIdx`,
`datasetName`, `startLabel`, `revision`, `dirty`. Each tab has its own undo/redo history
(`useDocumentHistory`).

## History coalescing

`applyDocument(mutation, { coalesceKey })` pushes the previous document unless the same
document/key was mutated within 700 ms. Object edits use `object:<id>`; printer/orientation/
document properties use their own keys. One drag/`object:modified` produces one entry.

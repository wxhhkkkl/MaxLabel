# Contract: Canvas Coordinates, Fit and Rotation

**Feature**: `016-editor-canvas` | **Date**: 2026-10-20

## Units

- Model geometry is millimetres.
- The editor base scale is 10 px/mm; screen size = `mm × 10 × zoom`.
- Zoom is clamped to ≥0.01 inside coordinate transforms; the UI clamps per-tab zoom to
  0.5–4× in `setZoom` for manual changes.

## Pointer normalisation

```ts
eventClientPoint(event): { x, y }
```

- Prefer `touches[0]`/`changedTouches[0]` when present, else the event itself.
- Use `clientX/clientY`; when both are 0 and `pageX/pageY` are non-zero, return
  `pageX − scrollX`, `pageY − scrollY`.
- Non-finite values become 0.

## Scene mapping

```ts
clientToCanvasPoint(client, bounds, sceneWidthPx, sceneHeightPx, zoom, rotation): { x, y }
```

1. `z = max(0.01, zoom)`.
2. Translate the client point to the canvas centre.
3. Rotate by `−rotation` (0/90/180/270).
4. Add half the scaled scene size and divide by zoom.
5. Values within 1e-9 of 0 are normalised to 0.

The same convention feeds frame-selection hit testing.

## Fit modes

```ts
computeFitZoom({ mode, widthMm, heightMm, rotation, availableWidthPx, availableHeightPx, gutterPx = 12 })
```

- `sideways = rotation % 180 !== 0`; swap `widthMm`/`heightMm` when sideways.
- `available = max(1, viewport − 2 × gutter)`.
- `fitW = availableW / (widthMm × 10)`; `fitH` likewise.
- `w` → fitW, `h` → fitH, `win` → min.

Manual zoom (`zoomMode === 'manual'`) is never recomputed by the fit effect; it survives
viewport changes. Fit modes recompute whenever the viewport or document size changes.

## Rotation

- Supported layout rotations: 0/90/180/270.
- Rotation is a CSS transform on the workspace; the paper outline and ruler origins remain
  aligned with the unrotated scene via `clientToCanvasPoint`.
- 90/270 swaps the effective width/height for fitting and scroll content.

## Non-goals

- Free-angle canvas rotation, pinch zoom, or a second coordinate system.

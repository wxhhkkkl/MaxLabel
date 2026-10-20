# Quickstart: Editor Canvas Interaction (As-Is)

**Feature**: `016-editor-canvas` | **Date**: 2026-10-20

## Prerequisites

- Windows 10/11 x64 primary; Node.js ≥ 22.12.0; `npm install` completed.
- `app/` builds and the existing test gate passes.
- No printer or scale is required.

## Automated validation

```bash
cd app
npm test
npm run test:coverage
env -u ELECTRON_RUN_AS_NODE npm run test:e2e
```

### Existing evidence

- `tests/unit/renderer/editor-geometry.test.ts` — Fabric ↔ model group round-trip.
- `tests/unit/renderer/operations.test.ts` — align/center/snap/size/distribute/order/group/lock.
- `tests/unit/renderer/document-history.test.ts` — undo/redo and coalescing.
- `tests/e2e/workspace-harness.spec.ts` — rulers, fit modes, zoom, paper clipping.

### Planned coverage (tests first, then code only if a test exposes a defect)

| Behavior | Test file | Layer |
|----------|-----------|-------|
| Client/page normalisation and rotation-aware scene mapping | `tests/unit/renderer/canvas-coordinates.test.ts` | unit |
| Fit width/height/window and axis swap | `tests/unit/renderer/fit-zoom.test.ts` | unit |
| Resize steps/minimums, Shift squares, text corner ratio | `tests/unit/renderer/resize-behavior.test.ts` | unit |
| Frame-selection rect intersection and hit testing | `tests/unit/renderer/frame-selection.test.ts` | unit |
| Arrange/group/lock thresholds and ordering | `tests/unit/renderer/operations.test.ts` | unit |
| Fabric sync for text/barcode boxes, groups and pure moves | `tests/unit/renderer/editor-geometry.test.ts` | unit |
| Clipboard payload, normalisation, fresh IDs and rejection | `tests/unit/renderer/object-clipboard.test.ts` | unit |
| New-object defaults and table keep-size | `tests/unit/renderer/object-factory.test.ts` | unit |
| Property tabs and geometry draft parsing/clamping | `tests/unit/renderer/object-properties.test.ts` | unit |
| Canvas drag/resize/rotate/selection/tabs | `tests/e2e/canvas-interaction.spec.ts` | e2e |

If a planned test exposes a mismatch, decide which side encodes the intended as-is behaviour
before changing code.

## Manual validation

### V-01 Coordinates, rulers and fit

1. New 80×60 mm label; enable rulers and grid.
2. Use 适应宽度, 适应高度, 撑满窗口, then manually zoom to 150% and resize the window.
3. Rotate the layout 90° and click objects.

Expected: fit modes follow the viewport and rotated axes; manual zoom stays 150%; ruler
zero matches the paper origin; clicks land on the intended object.

### V-02 Drag, resize and rotation

1. Drag a barcode 5 mm; resize a text with a corner handle and an edge handle.
2. Shift-resize a rectangle.
3. Rotate a group 30° and move it.

Expected: a pure drag does not change model width/height; text corner drags keep the glyph
ratio; Shift keeps a square; group children keep their relative geometry.

### V-03 Selection and arrangement

1. Frame-select several objects; add/remove a selection with the canvas behaviour.
2. Align two objects; distribute three; reorder front/back; group/ungroup; lock one and try
   to move it.

Expected: frame selection includes intersecting objects (rotation-aware); thresholds match
the menu state; locked objects do not move; group/ungroup preserves geometry.

### V-04 Clipboard

1. Copy a text object and paste it in the same template.
2. Copy a group, switch to another template and paste it.
3. Copy non-MaxLabel text from another application and paste.

Expected: copies get new IDs and a 1 mm offset; cross-template paste works; non-MaxLabel
content creates no objects.

### V-05 New objects and properties

1. Create text, barcode, RFID, rect, ellipse, table, line, diagonal and image objects.
2. Open properties; change x/y/w/h/rotation and confirm; enter an invalid number once.
3. Double-click an object and use the data tool on a text object.

Expected: defaults match the contract; invalid geometry falls back; width/height never go
below 0.1 mm; double-click opens properties and the data tool opens “修改数据”.

### V-06 Tabs and history

1. Open two templates, change zoom/tool/selection in each, and edit objects.
2. Undo/redo; close one tab.

Expected: each tab keeps its own zoom/tool/selection/history; a drag is one undo step; the
other tab is unaffected.

## Validation record (2026-10-20)

| Gate | Command | Result |
|------|---------|--------|
| Baseline before changes | `env -u ELECTRON_RUN_AS_NODE npm test` | 624 tests / 33 E2E PASS |
| Typecheck (node/web/test) + Vitest | `env -u ELECTRON_RUN_AS_NODE npm test` | 106 files / 656 tests PASS |
| Coverage (`shared/domain` + `shared/print`, 80% lines) | `npm run test:coverage` | PASS — 87.53% lines |
| Playwright Electron E2E | `env -u ELECTRON_RUN_AS_NODE npx playwright test` | 35 passed |

Scenario evidence:

| Scenario | Evidence | Result |
|----------|----------|--------|
| V-01 coordinates, rulers and fit | `unit/renderer/canvas-coordinates.test.ts`, `fit-zoom.test.ts`, `e2e/canvas-interaction.spec.ts` | PASS |
| V-02 drag/resize/rotation sync | `unit/renderer/resize-behavior.test.ts`, `editor-geometry.test.ts` (jsdom) | PASS at the model/adapter level; drag gestures themselves are not replayed in E2E |
| V-03 selection, arrange and clipboard | `unit/renderer/frame-selection.test.ts`, `operations.test.ts`, `object-clipboard.test.ts`, E2E copy/paste/group | PASS |
| V-04 clipboard | `unit/renderer/object-clipboard.test.ts`, `e2e/canvas-interaction.spec.ts` (paste status) | PASS |
| V-05 new objects and properties | `unit/renderer/object-factory.test.ts`, `object-properties.test.ts`, E2E geometry/rotation/fallback | PASS |
| V-06 tabs and history | `unit/renderer/document-history.test.ts`, existing editor-shell tab E2E | PASS |

Implementation notes:

- `clientRectFromPoints`/`rectIntersects`/`objectClientBounds` moved to
  `editor/frameSelection.ts`; `cloneWithFreshIds` moved next to `readObjectClipboard`;
  `parseGeometryDraft` extracted for the property draft; `boxAlignment`/`modelBoxOffset`
  exported from `syncFromFabric`. All behaviour-preserving.
- The Fabric text/barcode sync tests run under jsdom; barcode box alignment is additionally
  covered through the pure alignment helpers to avoid canvas image loading in Node.

Not exercised: physical pointer drag gestures, touch input, and free-angle canvas rotation.

## Known boundaries (do not change without owner confirmation)

- Additive frame-selection gestures beyond the documented drag are implementation-defined
  (`TODO(待确认)`).
- The geometry draft has no explicit cancel/rollback; the dialog controls commit
  (`TODO(待确认)`).
- Objects may extend outside the paper while editing; output clipping is owned by 003.

## Out of scope

- Free-angle canvas rotation, touch gestures, or a second coordinate system.
- Changing object types, defaults or the template format.

# Research: Editor Canvas Interaction (As-Is)

**Feature**: `016-editor-canvas` | **Date**: 2026-10-20

## Method

Brownfield analysis of the Fabric adapter, coordinate helpers, resize rules, operation
helpers, document commands/clipboard, object factory, property geometry draft and the
existing geometry/history tests. No new interaction was designed. Open questions remain
`TODO(待确认)`.

## D-001: Millimetres are the model unit

- **Decision**: `LabelObject.x/y/w/h` are millimetres. Screen pixels are only projections:
  scene pixels = mm × 10 × zoom (the editor base scale), with the canvas rotation applied
  around the viewport centre.
- **Rationale**: The same model feeds the editor, preview and print; storing pixels would
  duplicate geometry and break DPI changes.
- **Alternatives considered**: Storing pixels (rejected: print/DPI coupling); storing both
  (rejected: two sources of truth).

## D-002: Pointer normalisation and rotation inverse

- **Decision**: `eventClientPoint` prefers `clientX/clientY`, but when a synthetic event
  reports `0,0` with non-zero `pageX/pageY`, it uses page coordinates minus scroll.
  `clientToCanvasPoint` subtracts the canvas centre, applies the inverse rotation matrix and
  divides by zoom.
- **Rationale**: Mouse, touch and CDP/Playwright events must land on the same scene point,
  including when the label layout is rotated 90/270°.
- **Alternatives considered**: Reading only `clientX/Y` (rejected: synthetic events fail);
  rotating the Fabric canvas instead of the DOM element (rejected: current architecture uses
  CSS rotation and hit-testing must match it).

## D-003: Fit and manual zoom

- **Decision**: Fit modes use `max(1, viewport − 2×12 px)` and `mm × 10`; `w`/`h`/`win` choose
  width/height/min. `manual` returns early and keeps the user's zoom when the window
  resizes. 90/270° rotation swaps the physical axes before fitting.
- **Rationale**: Matches the existing `WorkArea` effect and the workspace E2E expectations.
- **Alternatives considered**: Recomputing every mode on resize (rejected: destroys manual
  zoom); using CSS transforms without a zoom number (rejected: the status bar and hit testing
  need the numeric zoom).

## D-004: Fabric → model sync

- **Decision**: Sync runs on `object:modified`. Text/barcode Fabric boxes are render boxes,
  not the model box; translate them back by alignment (`align/verticalAlign`, `barcodeAlign`)
  and preserve `w/h` when the box scale did not change. Groups write child geometry in the
  group's local space through the transform matrix.
- **Rationale**: Recorded defects showed pure drags shrinking barcodes/text and groups
  drifting; the current `syncFromFabric` already encodes the fix.
- **Alternatives considered**: Using Fabric's `left/top/width/height` directly (rejected:
  renders differ from model frames); syncing every frame (rejected: history spam).

## D-005: Resize constraints

- **Decision**: Barcode and printer-font text snap to 0.1 mm; all objects have a 0.5 mm
  minimum; rect/ellipse/line/table keep equal width/height with Shift; text corner handles
  preserve glyph ratio while edge handles allow stretching.
- **Rationale**: Matches LabelShop output steps and the current `constrainFabricResize`.
- **Alternatives considered**: Free resizing (rejected: invalid barcode dimensions);
  uniform scaling for everything (rejected: text needs stretching).

## D-006: Selection

- **Decision**: Multi-selection is Fabric's active-object set, filtered to model IDs; a frame
  drag selects objects whose rotation-aware client bounds intersect the frame (minimum 3 px
  movement).
- **Rationale**: Uses the canvas engine for hit testing and the model for identity.
- **Alternatives considered**: A custom quadtree (rejected: unnecessary); model-only bounds
  (rejected: ignores rotation/zoom).

## D-007: Arrange operations

- **Decision**: Align/center/snap/same-size operate on the selected set; align/size require
  ≥2 objects, distribute ≥3, group ≥2, ungroup exactly one group. Locked objects are not
  moved. Reorder supports front/forward/backward/back.
- **Rationale**: The thresholds are shared with menus/toolbar through `editorAvailability`;
  keeping them in `operations` preserves one rule set.
- **Alternatives considered**: Per-command thresholds inside the menu (rejected: drift).

## D-008: Undo/redo and coalescing

- **Decision**: Each document has its own history. `applyDocument` pushes a snapshot unless
  the same `coalesceKey` was used within 700 ms; object edits use `object:<id>`, printer/
  orientation use their own keys. One drag/`object:modified` produces one entry.
- **Rationale**: Prevents a per-keystroke history explosion and keeps tabs independent.
- **Alternatives considered**: Per-frame history (rejected: unusable); a global history
  (rejected: cross-tab undo would be wrong).

## D-009: Clipboard

- **Decision**: Copy/cut write
  `{ format: 'maxlabel-objects', version: 1, objects }` to the system clipboard and keep an
  in-memory copy. Paste reads the system clipboard, falls back to the in-memory copy, runs
  `normalizeDocument` over the objects, assigns fresh IDs (and +1 mm offsets), appends them
  and selects the last copy. Empty/non-MaxLabel text yields no objects.
- **Rationale**: Cross-template paste and safe rejection are the current behaviour; IDs must
  not collide with existing objects.
- **Alternatives considered**: Internal-only clipboard (rejected: breaks cross-template
  paste); trusting raw JSON (rejected: malformed documents could enter the model).

## D-010: New-object defaults and geometry draft

- **Decision**: `createLabelObject` is the only source of defaults (text/barcode/RFID/rect/
  ellipse/table/line/diagonal/image). Tables read `keepSize` from system options. The
  property geometry draft parses x/y/w/h/rotation on commit; invalid numbers fall back and
  width/height clamp to ≥0.1.
- **Rationale**: Keeps defaults consistent across toolbar, shortcuts and menu creation.
- **Alternatives considered**: Per-tool defaults (rejected: drift); live model updates while
  typing (rejected: noisy history and invalid intermediate sizes).

## D-011: Per-tab interaction state

- **Decision**: Zoom, zoom mode, tool, selection ID, record index and history live on
  `DocTab`, not globally.
- **Rationale**: Switching tabs must not change another document's view or history.
- **Alternatives considered**: Global editor state (rejected: cross-tab leakage).

## Open Questions (deferred)

- Exact frame-selection gesture details (e.g. additive Shift selection) beyond the documented
  drag threshold — `TODO(待确认)`; the spec bounds only the outcome.
- Whether the geometry draft needs an explicit cancel/rollback — `TODO(待确认)`.
- Editing objects outside the paper is allowed; output clipping is owned by 003.

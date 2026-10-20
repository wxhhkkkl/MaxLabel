# Implementation Plan: Editor Canvas Interaction (As-Is)

**Branch**: `016-editor-canvas` | **Date**: 2026-10-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/016-editor-canvas/spec.md`

**Note**: Brownfield **as-is** baseline. The plan closes documentation and test gaps around
shipped canvas interaction; it does not add a new editor feature.

## Summary

Document and verify the millimetre canvas: pointer/zoom/rotation mapping, fit modes and
rulers/grid, Fabric↔model synchronisation for single objects and groups, resize constraints,
multi-select/frame selection, arrange/group/lock commands, clipboard round-trips, new-object
defaults, property-page geometry editing and per-tab interaction state. Runtime behaviour
stays unchanged except where a test proves a documented rule is not met.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Electron 44.3.0, Fabric.js

**Primary Dependencies**: No new runtime dependency. Existing Fabric canvas adapter
(`syncFromFabric`, `fabricObjects`), coordinate helpers, resize rules, operation helpers,
document commands/clipboard, object factory and property dialog.

**Storage**: Object geometry persists on `LabelObject` (`x/y/w/h/rotation` and type-specific
fields) inside `.msdx`; clipboard content is transient JSON on the system clipboard; zoom and
tool are per-`DocTab` session state. No new persisted field.

**Testing**: Vitest (unit/integration) and Playwright Electron E2E. Existing evidence:
`tests/unit/renderer/editor-geometry.test.ts` (Fabric↔model groups), `operations.test.ts`
(arrange/group/lock), `document-history.test.ts` (undo/redo, coalescing) and
`tests/e2e/workspace-harness.spec.ts` (rulers, fit, zoom, clipping). New tests are required
for coordinate mapping, resize constraints, frame selection, clipboard and factory defaults
before any code change.

**Target Platform**: Windows 10/11 x64 primary; macOS/Linux builds per `005-cross-platform`.

**Performance Goals**: No product-level SLO. Dragging/resizing must stay responsive; sync runs
once per `object:modified` event, not per frame.

**Constraints**: Millimetres are the only physical coordinate system; the model stays the
source of truth (Fabric objects are projections); no second geometry implementation; no
print-pipeline or template-format change.

**Scale/Scope**: Up to 100 layout rows/columns and the existing object limits; one Fabric
canvas per editor tab; single- and multi-object selection; groups with nested children.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status | Notes |
|-----------|------|--------|-------|
| I. 测试先行（TDD） | New tests written and seen failing before code changes | **PASS** | Plan tasks start with failing coordinate/resize/clipboard/factory tests. Existing geometry tests are extended, not replaced. |
| II. 先澄清，不猜测 | Ambiguities recorded, not guessed | **PASS (bounded)** | Frame-selection gesture details, clipboard cross-template semantics and geometry-draft cancel behaviour stay `TODO(待确认)` where the spec only bounds outcomes. |
| III. 巨大架构变更先确认 | No architecture-level change | **PASS** | No dependency, process, storage or template change; Fabric sync/extraction stays in the renderer. |
| Single geometry | MM coordinates and model box updates exist once | **PASS** | `canvasCoordinates`, `syncFromFabric` and `resizeBehavior` remain the only implementations; tests import them. |
| Evidence rule | Every FR traces to code/tests | **PASS** | Each FR in `spec.md` carries `Evidence:`; this plan adds tests for rules that currently only have code evidence. |

**Post-design re-check**: unchanged; no violations, no complexity exceptions.

## Project Structure

### Documentation (this feature)

```text
specs/016-editor-canvas/
├── plan.md              # This file
├── spec.md              # As-is specification
├── research.md          # Phase 0 decisions
├── data-model.md        # geometry, selection, clipboard, factory entities
├── quickstart.md        # Validation scenarios
├── contracts/
│   ├── canvas-coordinates.md
│   ├── fabric-model-sync.md
│   ├── object-clipboard.md
│   └── object-creation-properties.md
└── checklists/
    └── requirements.md
```

`tasks.md` is produced by `/speckit-tasks`.

### Source Code (repository root)

```text
app/src/renderer/src/
├── editor/
│   ├── canvasCoordinates.ts   # client/page → scene mapping with rotation
│   ├── fitZoom.ts             # fit width/height/window
│   ├── LabelEditor.tsx        # Fabric canvas, grid, paper outline
│   └── WorkArea.tsx           # rulers, zoom, rotation, frame selection
├── features/canvas/syncFromFabric.ts   # Fabric → model sync, groups, alignment boxes
├── features/editor/
│   ├── resizeBehavior.ts      # 0.1 mm steps, min 0.5, text/barcode rules
│   ├── operations.ts          # align/center/snap/size/distribute/order/group/lock
│   ├── objectFactory.ts       # new-object defaults
│   └── useDocumentCommands.ts # selection, clipboard, delete, lock
├── features/object-properties/
│   ├── useObjectGeometryDraft.ts
│   └── propertyTabs.ts
└── features/workspace/useDocumentHistory.ts  # per-document undo/redo

app/tests/
├── unit/renderer/             # coordinates, resize, operations, geometry, history
├── integration/renderer/      # clipboard/factory/property helpers if needed
└── e2e/                       # workspace/canvas journeys
```

**Structure Decision**: Keep all canvas logic in the existing renderer modules. No new
package, process or persisted field is introduced.

## Phase 0 — Research

See [research.md](./research.md). Decisions:

- D-001: Millimetres are the model unit; screen pixels are derived through zoom and rotation.
- D-002: Pointer input normalises client/page coordinates; the scene mapping applies the
  inverse layout rotation.
- D-003: Fit modes (`w`, `h`, `win`) use the viewport minus a 12 px gutter; manual zoom
  survives resize.
- D-004: Fabric→model sync runs on `object:modified`; text/barcode render boxes map back to
  the model box by alignment, and pure moves/rotations preserve model width/height.
- D-005: Resize rules: 0.1 mm steps for barcode/printer-font text, 0.5 mm minimum, Shift
  squares geometric objects, text corner handles preserve the glyph ratio.
- D-006: Frame selection intersects rotation-aware client bounds; multi-select comes from
  Fabric's active objects.
- D-007: Arrange operations use the selection thresholds from `editorAvailability`.
- D-008: Undo/redo is per document; continuous edits coalesce when a coalesce key is given.
- D-009: Clipboard payload is `{ format: 'maxlabel-objects', version: 1, objects }`; paste
  normalises objects and assigns fresh IDs.
- D-010: New objects come from `createLabelObject`; the table `keepSize` default comes from
  system options; property geometry commits parse numbers, fall back on invalid input and
  enforce a 0.1 mm minimum width/height.
- D-011: Zoom, tool, selection, record index and history live on `DocTab`.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md): `CanvasPoint`, selection state, `ResizeInput/Output`,
  operation inputs, clipboard payload, object-factory defaults and property tabs.
- [contracts/canvas-coordinates.md](./contracts/canvas-coordinates.md): pointer
  normalisation, rotation inverse, fit/zoom rules.
- [contracts/fabric-model-sync.md](./contracts/fabric-model-sync.md): sync triggers, box
  alignment, group transforms and resize constraints.
- [contracts/object-clipboard.md](./contracts/object-clipboard.md): payload, read/normalise,
  fresh IDs and rejection of non-MaxLabel content.
- [contracts/object-creation-properties.md](./contracts/object-creation-properties.md): new
  object defaults, property tabs and geometry draft.
- [quickstart.md](./quickstart.md): automated and manual validation scenarios.

## Complexity Tracking

No constitution violations; no complexity exceptions.

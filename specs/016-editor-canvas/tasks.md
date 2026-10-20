---
description: "Task list for editor canvas interaction (as-is verification)"
---

# Tasks: Editor Canvas Interaction (As-Is)

**Input**: Design documents from `specs/016-editor-canvas/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`,
`quickstart.md`

**Tests**: Required (project constitution). New tests are written and seen failing before
any production-code change. This is an as-is feature; production changes are limited to
behaviour-preserving extractions and fixes a test proves necessary.

**Organization**: Tasks follow the four user stories. US1 (coordinates/fit) is the MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: `[US1]` … `[US4]` for user-story phases only
- Every task names an exact file path or command

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 [P] Create canvas test fixtures (client rects, zoom/rotation inputs, object and group builders, in-memory clipboard text) in `app/tests/helpers/canvas.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T002 Run `cd app && env -u ELECTRON_RUN_AS_NODE npm test` to confirm the baseline gate is green and record it in `specs/016-editor-canvas/quickstart.md` (Validation record).

**Checkpoint**: Fixtures and baseline ready.

---

## Phase 3: User Story 1 - Millimetre canvas, zoom and rotation (Priority: P1) 🎯 MVP

**Goal**: Pointer input maps correctly under zoom/rotation, fit modes follow the viewport,
and manual zoom survives resize.

**Independent Test**: Rotate the layout 90°, click objects, switch fit modes, then manually
zoom to 150% and resize the window; the click lands correctly and zoom stays 150%.

### Tests for User Story 1

- [X] T003 [P] [US1] Write failing coordinate tests (client/page fallback, inverse rotation at 0/90/180/270, zoom clamp, near-zero normalisation) in `app/tests/unit/renderer/canvas-coordinates.test.ts`.
- [X] T004 [P] [US1] Extend `app/tests/unit/renderer/fit-zoom.test.ts` with failing axis-swap/gutter/minimum-viewport cases for `computeFitZoom` and the manual-vs-fit split.

### Implementation for User Story 1

- [X] T005 [US1] Verify `eventClientPoint` and `clientToCanvasPoint` in `app/src/renderer/src/editor/canvasCoordinates.ts` against T003; no behavior change unless a test proves a gap.
- [X] T006 [US1] Verify `computeFitZoom` in `app/src/renderer/src/editor/fitZoom.ts` and the manual/fit effect in `app/src/renderer/src/editor/WorkArea.tsx` against T004; no behavior change unless a test proves a gap.
- [X] T007 [US1] Add E2E coverage in `app/tests/e2e/canvas-interaction.spec.ts`: rulers/grid, fit width/height/window, manual zoom surviving a window resize, and rotated-canvas clicking.

**Checkpoint**: Coordinates, fit and rotation are verified.

---

## Phase 4: User Story 2 - Drag, resize and model synchronisation (Priority: P1)

**Goal**: Dragging/resizing/rotating produces the documented model geometry, including
text/barcode frames and groups.

**Independent Test**: Drag a barcode without changing its size; resize text by a corner and
an edge; Shift-resize a rectangle; rotate a group without distorting children.

### Tests for User Story 2

- [X] T008 [P] [US2] Write failing resize tests (0.1 mm snapping, 0.5 mm minimum, Shift squares, text corner ratio, negative scales) in `app/tests/unit/renderer/resize-behavior.test.ts`.
- [X] T009 [P] [US2] Extend `app/tests/unit/renderer/editor-geometry.test.ts` with failing text/barcode box-alignment, pure-move size preservation and nested-group cases.

### Implementation for User Story 2

- [X] T010 [US2] Verify `constrainFabricResize` in `app/src/renderer/src/features/editor/resizeBehavior.ts` against T008; no behavior change unless a test proves a gap.
- [X] T011 [US2] Verify `syncFromFabric` in `app/src/renderer/src/features/canvas/syncFromFabric.ts` against T009; no behavior change unless a test proves a gap.
- [X] T012 [US2] Extend `app/tests/e2e/canvas-interaction.spec.ts`: drag/resize/rotate a barcode, text and group and check the persisted geometry.

**Checkpoint**: Sync and resize rules are verified.

---

## Phase 5: User Story 3 - Selection, arrange and clipboard (Priority: P2)

**Goal**: Frame selection, arrange/group/lock commands and clipboard round-trips behave as
documented.

**Independent Test**: Frame-select objects, align two, distribute three, reorder, group and
lock; copy/paste within and across templates; paste non-MaxLabel text.

### Tests for User Story 3

- [X] T013 [P] [US3] Write failing frame-selection tests (rotation-aware intersection, <3 px ignore, object bounds) importing `clientRectFromPoints`/`rectIntersects`/`objectClientBounds` from `app/src/renderer/src/editor/frameSelection.ts` in `app/tests/unit/renderer/frame-selection.test.ts`.
- [X] T014 [P] [US3] Extend `app/tests/unit/renderer/operations.test.ts` with threshold/order/group/ungroup/locked-object cases.
- [X] T015 [P] [US3] Write failing clipboard tests (envelope/bare array, normalisation, non-MaxLabel rejection, fresh IDs/+1 mm, group recursion) in `app/tests/unit/renderer/object-clipboard.test.ts`.

### Implementation for User Story 3

- [X] T016 [US3] Extract `clientRectFromPoints`, `rectIntersects` and `objectClientBounds` from `app/src/renderer/src/editor/WorkArea.tsx` into `app/src/renderer/src/editor/frameSelection.ts` and wire them back (no behavior change) so T013 passes.
- [X] T017 [US3] Verify `app/src/renderer/src/features/editor/operations.ts` against T014; no behavior change unless a test proves a gap.
- [X] T018 [US3] Extract/export `cloneWithFreshIds` next to `readObjectClipboard` in `app/src/renderer/src/features/editor/objectClipboard.ts` and use it from `useDocumentCommands.ts` (no behavior change) so T015 passes.
- [X] T019 [US3] Extend `app/tests/e2e/canvas-interaction.spec.ts`: frame select, align/distribute, group/ungroup, lock, and copy/paste in the same template.

**Checkpoint**: Selection, arrange and clipboard are verified.

---

## Phase 6: User Story 4 - New objects and property geometry (Priority: P3)

**Goal**: New-object defaults and property-page geometry editing match the contract.

**Independent Test**: Create each object type, check defaults; edit geometry with valid and
invalid values; open properties by double-click and the data tool.

### Tests for User Story 4

- [X] T020 [P] [US4] Write failing factory tests (default frames/fields for all creatable types, table keepSize from defaults, unsupported type → null) in `app/tests/unit/renderer/object-factory.test.ts`.
- [X] T021 [P] [US4] Write failing property tests (tab order per object type, geometry draft parsing/fallback/minimum 0.1 mm) importing a pure `parseGeometryDraft` from `app/src/renderer/src/features/object-properties/geometryDraft.ts` in `app/tests/unit/renderer/object-properties.test.ts`.

### Implementation for User Story 4

- [X] T022 [US4] Verify `createLabelObject` in `app/src/renderer/src/features/editor/objectFactory.ts` against T020; no behavior change unless a test proves a gap.
- [X] T023 [US4] Add `app/src/renderer/src/features/object-properties/geometryDraft.ts` with `parseGeometryDraft`, use it from `useObjectGeometryDraft.ts` (no behavior change) so T021 passes.
- [X] T024 [US4] Extend `app/tests/e2e/canvas-interaction.spec.ts`: create text/barcode/table, edit geometry with a valid and an invalid value, open properties by double-click and the data tool.

**Checkpoint**: Factory and property geometry are verified.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T025 [P] Update `app/tests/INDEX.md` and `app/tests/README.md` with the canvas test files.
- [X] T026 Run the full gate: `cd app && env -u ELECTRON_RUN_AS_NODE npm test`, `npm run test:coverage`, and `env -u ELECTRON_RUN_AS_NODE npm run test:e2e`; record the results in `specs/016-editor-canvas/quickstart.md`.
- [X] T027 Run manual validation V-01–V-06 from `specs/016-editor-canvas/quickstart.md` and record the outcomes there.
- [X] T028 Update `specs/016-editor-canvas/spec.md`/`data-model.md` only for confirmed as-is corrections found during verification; leave the three `TODO(待确认)` items unresolved unless the owner decides.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → no dependencies.
- **Foundational (Phase 2)** → depends on Setup; blocks all stories.
- **US1 (Phase 3)** → depends on Foundational; MVP.
- **US2 (Phase 4)** → depends on US1's coordinate mapping for hit testing.
- **US3 (Phase 5)** → depends on US2's sync for geometry after arrange operations.
- **US4 (Phase 6)** → depends on Foundational; factory/properties can run independently.
- **Polish (Phase 7)** → depends on the desired stories.

### Within Each Story

- Tests first, seen failing, then the smallest behavior-preserving change.
- One coordinate/sync/resize implementation only; do not add a second geometry rule.
- A test that exposes a mismatch is a stop-and-clarify point unless it is a documented TODO.

### Parallel Opportunities

- T003/T004 (coordinates vs fit).
- T008/T009 (resize vs sync).
- T013/T014/T015 (frame selection, operations, clipboard).
- T020/T021 (factory vs properties).
- T025 documentation while the gate runs.

---

## Parallel Example: User Story 3

```text
T013  frame-selection tests     tests/unit/renderer/frame-selection.test.ts
T014  operations tests          tests/unit/renderer/operations.test.ts
T015  clipboard tests           tests/unit/renderer/object-clipboard.test.ts
```

---

## Implementation Strategy

### MVP First

1. Setup + Foundational (T001–T002).
2. US1 (T003–T007).
3. **STOP and VALIDATE**: coordinates, fit and rotation on a real document.

### Incremental Delivery

1. US1 → coordinate/fit correctness.
2. US2 → drag/resize/group sync.
3. US3 → selection/arrange/clipboard.
4. US4 → new objects/properties.
5. Polish → full gate and recorded validation.

### Safety Rules

- Keep millimetres as the model unit and Fabric as a projection.
- Do not add a second coordinate/resize/selection implementation.
- Do not change object defaults, property tab order or the clipboard payload format.
- Do not persist zoom/tool outside `DocTab`.

## Notes

- Existing geometry/operations/history tests are extended, not replaced.
- Real printers are unnecessary; all scenarios run in the editor.
- The E2E spec covers the visible journeys; pure helpers cover edge cases.

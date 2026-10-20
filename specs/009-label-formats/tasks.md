---
description: "Task list for label formats and page setup (as-is verification)"
---

# Tasks: Label Formats and Page Setup (As-Is)

**Input**: Design documents from `specs/009-label-formats/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`,
`quickstart.md`

**Tests**: Required (project constitution). New tests are written and seen failing before
any production-code change. This is an as-is feature, so most tasks verify existing behavior;
production code changes are limited to extracting pure helpers so the rules can be tested.
Any test that exposes a behavior mismatch must be resolved by clarifying the intended as-is
behavior first — do not silently "fix" it.

**Organization**: Tasks follow the four user stories. US1 (preset selection) is the MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: `[US1]` … `[US4]` for user-story phases only
- Every task names an exact file path or command

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared fixtures used by all stories.

- [X] T001 [P] Create label-format test fixtures (LabelShop catalog printer, Windows driver printer, brand-named driver, no-printer configs, sample `LabelDoc` builders) in `app/tests/helpers/labelFormats.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared, pure helpers and a known-green baseline required by every story.

- [X] T002 [P] Add paper/geometry assertion helpers (`expectPath`, hole/shape builders) in `app/tests/helpers/paper.ts`.
- [X] T003 Run `cd app && env -u ELECTRON_RUN_AS_NODE npm test` to confirm the baseline gate is green; record the result in `specs/009-label-formats/quickstart.md` (Validation record).

**Checkpoint**: Fixtures and baseline ready.

---

## Phase 3: User Story 1 - Create a label from the standard format library (Priority: P1) 🎯 MVP

**Goal**: Select a roll/sheet format in the New Label dialog; media filtering, the
brand/type/format picker and the selection-to-document mapping match the as-is behavior.

**Independent Test**: Open New Label, select `608053`, confirm; the document is 100×70 mm,
2×4 with 2 mm gaps and a 210×297 mm page, and the status bar shows the spec.

### Tests for User Story 1

> Write these tests FIRST and confirm they FAIL for the right reason.

- [X] T004 [P] [US1] Write failing media-classification tests (LabelShop → roll, driver → sheet, brand-named driver → roll, no printer + non-driver → roll, no printer + driver → name heuristic) in `app/tests/unit/renderer/label-formats-media.test.ts`.
- [X] T005 [P] [US1] Write failing catalog-query tests (filter by media, brand/category ordering, default `608053`, unknown code fallback, media-switch reset) in `app/tests/unit/renderer/label-formats-catalog.test.ts`.
- [X] T006 [P] [US1] Write a failing integration test for selection → document mapping (rows/cols/gaps/page size/pagesPerBox/formatKind set; `formatCode` not persisted) importing `applyLabelFormatToDoc` from `app/src/renderer/src/features/label-formats/applyFormat.ts` in `app/tests/integration/renderer/new-label-mapping.test.ts`.

### Implementation for User Story 1

- [X] T007 [US1] Extract `mediaTypeOfSelection` and the roll-name pattern from `app/src/renderer/src/dialogs/NewLabelDialog.tsx` into `app/src/renderer/src/features/label-formats/mediaType.ts` (no behavior change) and wire the dialog to it so T004 passes.
- [X] T008 [US1] Add `app/src/renderer/src/features/label-formats/catalog.ts` with `formatsByMedia`, `brandsOf`, `categoriesOf`, `resolveSelectedFormat`, `nextFormatForMedia` and use it in `NewLabelDialog.tsx` so T005 passes.
- [X] T009 [US1] Add `app/src/renderer/src/features/label-formats/applyFormat.ts` with `applyLabelFormatToDoc` and use it from `App.handleNewFromDialog` in `app/src/renderer/src/App.tsx` (no behavior change) so T006 passes.
- [X] T010 [US1] Add E2E coverage in `app/tests/e2e/new-label-format.spec.ts`: open New Label, select `608053`, confirm, assert the status bar/label spec (100×70 mm, 2 columns × 4 rows) and that the current document was not replaced when opening the dialog.
- [X] T011 [US1] Verify the selection payload returned by `NewLabelDialog.confirm` against `specs/009-label-formats/contracts/label-format-selection.md`; adjust only the test or a pure helper, never the persisted template format.

**Checkpoint**: US1 works with the real catalog; no template-format change.

---

## Phase 4: User Story 2 - Define a custom label format (Priority: P1)

**Goal**: The custom dialog validates size/grid, shapes and holes, and produces geometry
that matches the shared paper rules.

**Independent Test**: Create 80×50 mm, 1 row × 2 columns, gaps 0, round rectangle, no hole;
the document uses those values and reopening the template properties shows them.

### Tests for User Story 2

- [X] T012 [P] [US2] Write failing unit tests for `formatMmValue` and a pure `isCustomLabelSizeValid` (5–500 mm, finite, rows/cols 1–100) in `app/tests/unit/renderer/custom-label-format.test.ts`.
- [X] T013 [P] [US2] Write failing unit tests for paper geometry (`paperPath` for rect/roundRect/ellipse, fixed ≈1 mm round-rect radius, hole centering/clamping, `holeSelectionOf`, `withHoleSelection`, `normalizeLabelColor`, page-size fallback helpers) in `app/tests/unit/shared/domain/paper.test.ts`.

### Implementation for User Story 2

- [X] T014 [US2] Add `app/src/renderer/src/features/label-formats/customFormat.ts` with `isCustomLabelSizeValid` and use it in `CustomLabelFormatDialog.confirm` in `app/src/renderer/src/dialogs/CustomLabelFormatDialog.tsx` (no behavior change) so T012 passes.
- [X] T015 [US2] Verify `app/src/shared/domain/paper.ts` and `app/src/renderer/src/dialogs/paperHoleFields.ts` against T013; if a test exposes a real mismatch, stop and clarify the intended as-is behavior before changing code.
- [X] T016 [US2] Add E2E coverage in `app/tests/e2e/custom-label-format.spec.ts`: choose 自定义, enter 80×50, 1 row × 2 columns, gaps 0, 圆角矩形, hole 无, confirm, and assert the status bar/label spec; then reopen 模板属性设置 and assert the values are shown.
- [X] T017 [US2] Verify the out-of-range path (width 4 or 501 mm) leaves the dialog open and creates no document; cover it in `app/tests/unit/renderer/custom-label-format.test.ts` and document the silent rejection as the current `TODO(待确认)` behavior.

**Checkpoint**: Custom geometry is validated and matches the shared paper rules.

---

## Phase 5: User Story 3 - Edit an existing custom label's page properties (Priority: P2)

**Goal**: 模板属性设置 rehydrates the current geometry, keeps rectangle holes, and is
read-only for preset formats; 标签格式设置 keeps creating a new document.

**Independent Test**: A custom document’s hole changes from rectangle to circle and
persists; a preset document shows the same fields read-only.

### Tests for User Story 3

- [X] T018 [P] [US3] Write failing unit tests for `geometryEditable(formatKind)`, `paperFromLayout(layout)`, and rectangle-hole rehydration in `app/tests/unit/renderer/template-props-geometry.test.ts`.
- [X] T019 [P] [US3] Write failing unit tests for the entry-point rule (标签格式设置 maps to the New Label modal; preset docs are read-only; custom docs editable) in `app/tests/unit/renderer/label-format-entry-points.test.ts`.

### Implementation for User Story 3

- [X] T020 [US3] Add `app/src/renderer/src/features/label-formats/templateGeometry.ts` with `geometryEditable` and `paperFromLayout`, and use it in `app/src/renderer/src/dialogs/TemplatePropsDialog.tsx` (no behavior change) so T018 passes.
- [X] T021 [US3] Verify the menu wiring in `app/src/renderer/src/features/commands/labelShopMenus.ts` and `app/src/renderer/src/features/shell/ModalHost.tsx` against T019; adjust only the test or an exported pure mapping, not the user-facing command.
- [X] T022 [US3] Add E2E coverage in `app/tests/e2e/template-props-geometry.spec.ts`: open a custom document, change a rectangle hole to a circle, confirm, and assert the paper outline; open a preset document and assert the page/label/shape/hole fields are read-only.

**Checkpoint**: Existing custom documents are editable; presets stay read-only.

---

## Phase 6: User Story 4 - Readable preview annotations (Priority: P2)

**Goal**: Preview sequence numbers and dimension labels stay readable for small and large
formats, and the roll preview uses the strip geometry.

**Independent Test**: Annotation font size stays within 9–17 px for 20×10 mm and 100×70 mm
labels; a roll format renders the main label with adjacent-label strips.

### Tests for User Story 4

- [X] T023 [P] [US4] Write failing unit tests for `previewScale`, `annotationFontSize` and `previewAnnotationLayout` (ratio 0.12, 9–17 px clamp, 2.2× margins) in `app/tests/unit/renderer/preview-annotation.test.ts`.
- [X] T024 [P] [US4] Write failing unit tests for preview geometry (page size fallback, grid size, roll strip height/slices) importing `computePreviewGeometry` from `app/src/renderer/src/features/label-formats/previewGeometry.ts` in `app/tests/unit/renderer/label-preview-geometry.test.ts`.

### Implementation for User Story 4

- [X] T025 [US4] Add `app/src/renderer/src/features/label-formats/previewGeometry.ts` and use it in `app/src/renderer/src/dialogs/NewLabelDialog.tsx` (no behavior change) so T024 passes.
- [X] T026 [US4] Verify `app/src/renderer/src/dialogs/previewAnnotation.ts` against T023; adjust only if a test exposes a real mismatch, and clarify first.
- [X] T027 [US4] Extend `app/tests/e2e/new-label-format.spec.ts` to assert the preview SVG contains sequence-number and dimension text for small and large formats.

**Checkpoint**: Annotations are readable and the roll preview follows the strip geometry.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T028 [P] Update `app/tests/INDEX.md` and `app/tests/README.md` with the label-format test files.
- [X] T029 Run the full gate: `cd app && env -u ELECTRON_RUN_AS_NODE npm test`, `npm run test:coverage`, and `env -u ELECTRON_RUN_AS_NODE npm run test:e2e`; record results in `specs/009-label-formats/quickstart.md`.
- [X] T030 Run the simulated/manual validation V-01–V-07 from `specs/009-label-formats/quickstart.md` and record the outcomes there.
- [X] T031 Update `specs/009-label-formats/spec.md`/`data-model.md` only for confirmed as-is corrections found during verification; leave the three `TODO(待确认)` items unresolved unless the owner decides.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → no dependencies.
- **Foundational (Phase 2)** → depends on Setup; blocks all stories.
- **US1 (Phase 3)** → depends on Foundational; MVP.
- **US2 (Phase 4)** → depends on Foundational; independent of US1 for the custom path.
- **US3 (Phase 5)** → depends on Foundational and the paper helpers used by US2.
- **US4 (Phase 6)** → depends on Foundational; independent of US1–US3.
- **Polish (Phase 7)** → depends on the desired stories.

### Within Each Story

- Tests first, seen failing, then the pure-helper extraction that makes them pass.
- No change to `LabelDoc`, `.msdx`, `PrintPlan`, protocol builders or the catalog.
- A test that exposes a mismatch is a stop-and-clarify point, not a license to redesign.

### Parallel Opportunities

- T001/T002 fixtures and baseline.
- T004/T005/T006 per story tests (different files).
- T012/T013 and T018/T019 and T023/T024.
- T028 documentation while the gate runs.

---

## Parallel Example: User Story 1

```text
T004  media classification tests       tests/unit/renderer/label-formats-media.test.ts
T005  catalog query tests              tests/unit/renderer/label-formats-catalog.test.ts
T006  selection mapping test           tests/integration/renderer/new-label-mapping.test.ts
```

---

## Implementation Strategy

### MVP First

1. Setup + Foundational (T001–T003).
2. US1 (T004–T011).
3. **STOP and VALIDATE**: select a preset, confirm, assert the document geometry.

### Incremental Delivery

1. US1 → preset selection works.
2. US2 → custom geometry is validated.
3. US3 → existing custom documents can be edited; presets are read-only.
4. US4 → preview annotations are readable.
5. Polish → full gate and recorded validation.

### Safety Rules

- Do not change the generated catalog or add a generator.
- Do not persist `formatCode` or add template fields.
- Do not make preset formats editable.
- Do not turn the silent out-of-range rejection into a new UX without owner approval.
- Do not duplicate paper geometry outside `shared/domain/paper.ts` + `paperHoleFields.ts`.

## Notes

- This feature documents and verifies shipped behavior; "implementation" tasks are
  behavior-preserving extractions that make the rules unit-testable.
- Real printers are not required for the automated scenarios; the E2E checks use the UI
  and the status bar.
- `formatCode` is selection-only; `LabelDoc` persists `formatKind` + geometry.

---

## Phase 8: Convergence

- [X] T032 Clamp custom-format rows and cols to integers 1–100 in the selection builder (`NewLabelDialog.confirmCustom`, optionally via a tested helper in `app/src/renderer/src/features/label-formats/customFormat.ts`), with a failing unit test typing 200 in `app/tests/unit/renderer/custom-label-format.test.ts` and a regression assertion in `app/tests/e2e/custom-label-format.spec.ts`, so an out-of-range grid never reaches `normalizeDocument` and throws, per FR-009 / Edge Cases (`partial`).

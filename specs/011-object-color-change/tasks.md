---
description: "Task list for object colour change and colour index tables (as-is verification)"
---

# Tasks: Object Colour Change and Colour Index Table (As-Is)

**Input**: Design documents from `specs/011-object-color-change/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`,
`quickstart.md`

**Tests**: Required (project constitution). New tests are written and seen failing before
any production-code change. This is an as-is feature; production changes are limited to the
verified native-raster gap (D-008) and any mismatch a test proves.

**Organization**: Tasks follow the three user stories. US1 (modes and granularity) is the
MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: `[US1]` … `[US3]` for user-story phases only
- Every task names an exact file path or command

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 [P] Create colour test fixtures (`ColorChangeConfig` builder, `DataCtx`/dataset builder, sample text/barcode/image objects, table fixtures) in `app/tests/helpers/color.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T002 Run `cd app && env -u ELECTRON_RUN_AS_NODE npm test` to confirm the baseline gate is green and record it in `specs/011-object-color-change/quickstart.md` (Validation record).

**Checkpoint**: Fixtures and baseline ready.

---

## Phase 3: User Story 1 - Configure dynamic colour modes and granularity (Priority: P1) 🎯 MVP

**Goal**: Every mode resolves to the documented plan, unsupported granularities collapse to
solid, normalization preserves old templates, and native output rasterises dynamic colour.

**Independent Test**: A text object with 颜色索引 `12` and 逐字符 shows two colours; a barcode
with 2×3 block colour shows six blocks; a dynamic-colour barcode on a native printer forces
the page bitmap.

### Tests for User Story 1

- [X] T003 [P] [US1] Extend `app/tests/unit/shared/domain/color-change.test.ts` with failing resolver cases for every mode, the granularity matrix, solid/char/block/gradient edge cases, empty-content fallbacks, deterministic random and image eligibility.
- [X] T004 [P] [US1] Write failing normalization tests (legacy `variable` → `valueVar`, unknown mode → `fixed`, unsupported granularity → `solid`, block rows/cols 1–100, private table ≤256×64, document `colorIndexTable` ≤256) in `app/tests/unit/shared/domain/color-change-normalize.test.ts`.
- [X] T005 [P] [US1] Write failing native-raster tests for non-fixed colour on text, rect, ellipse **and barcode** (TSPL/ZPL/CPCL) in `app/tests/integration/renderer/color-native.test.ts`.
- [X] T006 [P] [US1] Write failing vector-fallback tests for block/gradient barcodes in `app/tests/integration/renderer/color-vector.test.ts`.

### Implementation for User Story 1

- [X] T007 [P] [US1] Verify `resolveColorChangePlan`/`resolveObjectColor` in `app/src/shared/domain/objects.ts` against T003; fix only a documented mismatch.
- [X] T008 [P] [US1] Verify `normalizeColorChange` and `colorIndexTable` handling in `app/src/shared/domain/document.ts` against T004; no behavior change unless a test proves a gap.
- [X] T009 [US1] Extend `sceneNeedsRasterization` in `app/src/shared/print/capabilities.ts` so any barcode with a non-fixed `colorChange` forces page rasterisation; make T005 pass.
- [X] T010 [US1] Verify barcode block/gradient raster fallback in `app/src/renderer/src/rendering/fabricObjects.ts` and `app/src/renderer/src/print/renderLabelSvg.ts` against T006; no behavior change unless a test proves a gap.
- [X] T011 [US1] Add E2E coverage in `app/tests/e2e/color-change.spec.ts`: set a text object to index/char colour and a barcode to 2×3 block colour, and confirm the preview reflects the mode and granularity.

**Checkpoint**: Modes, granularity and native fallback are verified.

---

## Phase 4: User Story 2 - Use shared and private colour index tables (Priority: P2)

**Goal**: Empty tables fall back to the ten predefined colours; shared/private tables are
independent, wrap correctly and persist with the document/object.

**Independent Test**: With an empty private table index 1 is red; after replacing index 0
with `#123456` the object uses it; switching to the shared table uses the document table.

### Tests for User Story 2

- [X] T012 [P] [US2] Write failing table tests (default ten colours, shared/private precedence, empty fallback, index wrap including negatives, 256/64 limits, comma/pipe parsing, save/reopen of `colorIndexTable`) in `app/tests/unit/shared/domain/color-index-table.test.ts`.

### Implementation for User Story 2

- [X] T013 [US2] Verify `colorTableFor`, `pickColor`, `parseColorValues` and `colorIndexForChar` in `app/src/shared/domain/objects.ts` against T012; no behavior change unless a test proves a gap.
- [X] T014 [US2] Verify `ColorIndexTableEditor` wiring in `app/src/renderer/src/dialogs/ObjectPropsDialog.tsx` writes private tables to the object and shared tables to `LabelDoc.colorIndexTable`, and add E2E coverage for switching the source and saving/reopening in `app/tests/e2e/color-change.spec.ts`.
- [X] T015 [US2] Verify shared-table persistence and the 256-colour limit through `app/src/shared/domain/document.ts` with a format round-trip test in `app/tests/unit/shared/domain/color-index-table.test.ts`.

**Checkpoint**: Table sources, defaults and persistence are verified.

---

## Phase 5: User Story 3 - Resolve colour from content, variables and inputs (Priority: P2)

**Goal**: Content indexing, named variables and direct inputs produce the documented colour
lists with safe fallbacks, and the property page exposes the right fields per mode.

**Independent Test**: `clr = 12` with index-variable/char yields index 1 then 2;
`clr = #FF0000|#00FF00` with value-variable yields those colours; empty inputs keep the
object colour.

### Tests for User Story 3

- [X] T016 [P] [US3] Write failing tests for `indexByContent` (text/barcode vs other types), `indexVar`/`valueVar` from `keyboardValues` and the active dataset row, comma/pipe values, and empty-value fallbacks in `app/tests/unit/shared/domain/color-change-variables.test.ts`.

### Implementation for User Story 3

- [X] T017 [US3] Verify `resolveNamedVariable` and the variable/input branches in `app/src/shared/domain/objects.ts` against T016; no behavior change unless a test proves a gap.
- [X] T018 [US3] Add E2E coverage in `app/tests/e2e/color-change.spec.ts`: the property page shows the variable/input fields for the relevant modes, the granularity list matches the object type, and an empty variable/input leaves the object colour.

**Checkpoint**: Content/variable/input modes and their UI are verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T019 [P] Update `app/tests/INDEX.md` and `app/tests/README.md` with the colour test files.
- [X] T020 Run the full gate: `cd app && env -u ELECTRON_RUN_AS_NODE npm test`, `npm run test:coverage`, and `env -u ELECTRON_RUN_AS_NODE npm run test:e2e`; record the results in `specs/011-object-color-change/quickstart.md`.
- [X] T021 Run manual validation V-01–V-06 from `specs/011-object-color-change/quickstart.md` and record the outcomes there.
- [X] T022 Update `specs/011-object-color-change/spec.md`/`data-model.md` only for confirmed as-is corrections found during verification; leave the three `TODO(待确认)` items unresolved unless the owner decides.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → no dependencies.
- **Foundational (Phase 2)** → depends on Setup; blocks all stories.
- **US1 (Phase 3)** → depends on Foundational; MVP.
- **US2 (Phase 4)** → depends on Foundational; table tests can run independently.
- **US3 (Phase 5)** → depends on Foundational and the resolver from US1.
- **Polish (Phase 6)** → depends on the desired stories.

### Within Each Story

- Tests first, seen failing, then the smallest change that makes them pass.
- Do not duplicate colour logic in renderers or adapters.
- A test that exposes a mismatch is a stop-and-clarify point unless the mismatch is D-008.

### Parallel Opportunities

- T003–T006 (independent test files).
- T007/T008 (different modules).
- T012 and T016 (different test files).
- T019 documentation while the gate runs.

---

## Parallel Example: User Story 1

```text
T003  resolver tests             tests/unit/shared/domain/color-change.test.ts
T004  normalization tests        tests/unit/shared/domain/color-change-normalize.test.ts
T005  native raster tests        tests/integration/renderer/color-native.test.ts
T006  vector fallback tests      tests/integration/renderer/color-vector.test.ts
```

---

## Implementation Strategy

### MVP First

1. Setup + Foundational (T001–T002).
2. US1 (T003–T011).
3. **STOP and VALIDATE**: mode/granularity preview and native raster fallback.

### Incremental Delivery

1. US1 → modes, granularity, native fallback.
2. US2 → shared/private tables and persistence.
3. US3 → content/variable/input modes and UI.
4. Polish → full gate and recorded validation.

### Safety Rules

- Keep `resolveColorChangePlan` as the only colour resolver.
- Do not add modes, granularities, predefined colours or template fields.
- Do not change the index formula or separator rules.
- Preserve the ten-colour fallback for empty tables.
- Do not make colour images tintable or change image semantics.

## Notes

- D-008 is the only expected production change: add barcode dynamic colour to the native
  raster trigger.
- Real printers are optional; native fallback is verified at the capability/scene level and
  through the existing print tests.

---

## Phase 7: Convergence

- [X] T023 Apply `resolveObjectColor` to the line stroke in `app/src/renderer/src/rendering/fabricObjects.ts` and include dynamic-colour lines in the native rasterisation trigger in `app/src/shared/print/capabilities.ts` (or replace the per-kind list with a generic dynamic-colour check), with failing tests in `app/tests/integration/renderer/color-line.test.ts` and `app/tests/integration/renderer/color-native.test.ts`, so a line's solid colour mode works in preview and native output per FR-002 / FR-011 / FR-013 (`contradicts`).

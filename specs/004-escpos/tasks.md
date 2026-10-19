---
description: "Task list for ESC/POS command support"
---

# Tasks: ESC/POS Command Support

**Input**: Design documents from `specs/004-escpos/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Required (TDD). Each implementation phase starts with failing tests; the
screen is red before the green implementation.

**Organization**: Tasks are grouped by user story. ESC/POS reuses the 003 scene/plan/
transport/log contracts; no second print pipeline is allowed.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files/commands)
- **[Story]**: `[US1]` … `[US6]` for user-story phases only
- Every task names an exact file path or command

## Phase 1: Setup (Test Scaffolding)

**Purpose**: Establish the red tests and golden contract before implementation.

- [x] T001 Add `escpos` to the `CommandSet` expectation and write failing config tests in `app/tests/unit/shared/domain/printer-escpos.test.ts`.
- [x] T002 Create `app/tests/unit/shared/print/escpos.test.ts` with failing cases for init/text/styles/1D/raster.
- [x] T003 Extend `app/scripts/generate-protocol-fixtures.ts` and `app/fixtures/protocol/protocol-snapshots.json` with an ESC/POS fixture, and add `app/tests/contracts/escpos-golden.test.ts` (red until the builder exists).

## Phase 2: Foundational

**Purpose**: Add the type/config/profile/validation/dispatch boundaries all stories need.

- [x] T004 Add `escpos` to `CommandSet` and the ESC/POS fields to `PrinterConfig` in `app/src/shared/domain/printer.ts`; make T001 pass.
- [x] T005 Create `app/src/shared/print/escposProfiles.ts` with `EscPosProfile` and a conservative `generic` profile; add `app/tests/unit/shared/print/escposProfiles.test.ts`.
- [x] T006 Extend `app/src/main/ipc/validation.ts` for ESC/POS command set/config fields; extend `app/tests/contracts/ipc-contract.test.ts`.
- [x] T007 Create the `app/src/shared/print/escpos.ts` builder skeleton and dispatch it from `app/src/shared/print/engine.ts`; add `app/tests/integration/renderer/print-executor-escpos.test.ts` baseline.

**Checkpoint**: Types/config/profile/dispatch compile; existing tests remain green.

## Phase 3: User Story 1 - 文字、一维条码与图片 (Priority: P1)

**Goal**: ESC/POS text/styles, 1D barcode and raster output.

**Independent Test**: `app/tests/unit/shared/print/escpos.test.ts` + executor ESC/POS test.

- [x] T008 [P] [US1] Implement initialization (`ESC @`), code page, alignment, text size/bold/underline/reverse/line spacing in `app/src/shared/print/escpos.ts`; make the text tests pass.
- [x] T009 [P] [US1] Implement `GS k` 1D barcode and `GS v 0` monochrome raster with printable-width validation in `app/src/shared/print/escpos.ts`; make the barcode/raster tests pass.
- [x] T010 [US1] Generate the ESC/POS golden via `npm run fixtures:print` and make `app/tests/contracts/escpos-golden.test.ts` pass.
- [x] T011 [US1] Assert the executor sends ESC/POS payloads with unchanged counts/copies/serials/log status in `app/tests/integration/renderer/print-executor-escpos.test.ts`.

**Checkpoint**: Text/1D/image print through the shared pipeline with golden evidence.

## Phase 4: User Story 2 - 控制命令 (Priority: P1)

**Goal**: Cut, cash drawer, feed and alignment controls.

**Independent Test**: command-order tests in `escpos.test.ts`.

- [x] T012 [P] [US2] Implement `GS V` cut, `ESC p` cash drawer, feed and alignment in `app/src/shared/print/escpos.ts`; add failing tests first.
- [x] T013 [US2] Handle unsupported cut/drawer capabilities with a warning while continuing content; add tests in `app/tests/unit/shared/print/escpos.test.ts`.

**Checkpoint**: Controls are configurable and unsupported ones do not abort content.

## Phase 5: User Story 3 - 二维条码 (Priority: P2)

**Goal**: Native QR/PDF417/DataMatrix with faithful fallback.

**Independent Test**: native vs fallback tests under two profiles.

- [x] T014 [P] [US3] Implement native QR (`GS ( k`) gated by `EscPosProfile.supportsQR`; add tests in `app/tests/unit/shared/print/escpos.test.ts`.
- [x] T015 [US3] Implement PDF417/DataMatrix native or raster fallback in `app/src/shared/print/escpos.ts`; add tests in `app/tests/unit/shared/print/escpos.test.ts` and ensure missing bitmap blocks sending.

**Checkpoint**: 2D output is profile-gated and never silently lost.

## Phase 6: User Story 4 - 能力档案与降级 (Priority: P2)

**Goal**: Profile registry, conservative defaults and fallback behavior.

**Independent Test**: `escposProfiles.test.ts` + fallback tests.

- [x] T016 [P] [US4] Populate known Epson-compatible profiles and unknown-model fallback in `app/src/shared/print/escposProfiles.ts`; add tests.
- [x] T017 [US4] Route unsupported text/shapes/colour/rotation to the existing bitmap fallback in `app/src/shared/print/escpos.ts`/`capabilities.ts`; add blocking tests.
- [x] T018 [US4] Reject documents containing RFID with a clear error in `app/src/shared/print/escpos.ts`; add a test.

**Checkpoint**: Profiles and fallbacks are explicit; unsupported content is never silently dropped.

## Phase 7: User Story 5 - 配置、UI、日志与兼容 (Priority: P2)

**Goal**: ESC/POS config UI, recommendations and regression compatibility.

**Independent Test**: config round-trip/UI + executor regression tests.

- [x] T019 [P] [US5] Add ESC/POS fields and command-set selector to `app/src/renderer/src/dialogs/PrinterSettings.tsx`; add a UI/unit test.
- [x] T020 [US5] Add ESC/POS recommendation mapping without hand-editing `printerCatalog.generated.ts`; add tests in `app/tests/unit/shared/domain/printer-escpos.test.ts`.
- [x] T021 [US5] Verify config round-trip, log/test-print/serial/partial semantics for ESC/POS in `app/tests/integration/renderer/print-executor-escpos.test.ts`.

**Checkpoint**: ESC/POS is a first-class config with unchanged pipeline semantics.

## Phase 8: User Story 6 - 真机矩阵 (Priority: P3)

**Goal**: Record real-device results and documentation.

**Independent Test**: completed `verification/hardware-matrix.md`.

- [ ] T022 [US6] Fill `specs/004-escpos/verification/hardware-matrix.md` for 58/80 mm devices (text/styles, 1D, 2D, image, cut, drawer, code pages, fallback).
- [x] T023 [US6] Update `app/tests/INDEX.md`, `app/tests/README.md` and `specs/003-printing-pipeline/verification/fr-matrix.md` for ESC/POS coverage.

**Checkpoint**: Hardware/documentation evidence is complete.

## Phase 9: Polish & Cross-Cutting

- [x] T024 Run the full gate: `npm test`, `npm run test:coverage`, `npm run test:e2e`; record results in `specs/004-escpos/quickstart.md`.
- [x] T025 Verify architecture invariants (no duplicate scene/plan/transport; adapters do not re-resolve) against `app/src/shared/print/escpos.ts`, `engine.ts`; record in `specs/004-escpos/research.md`.
- [ ] T026 Resolve Q-001–Q-007 (models, code pages, drawer pin, cut default, QR support, 300 dpi widths, RFID) and update `specs/004-escpos/spec.md` and `specs/004-escpos/research.md`.
- [ ] T027 Commit the ESC/POS feature with `git add specs/004-escpos app && git commit`.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → no dependencies.
- **Foundational (Phase 2)** → depends on Setup; blocks all user stories.
- **US1 (Phase 3)** → depends on Foundational; core builder.
- **US2 (Phase 4)** → depends on US1 text/raster infrastructure.
- **US3 (Phase 5)** → depends on US1 builder + US4 profile contract.
- **US4 (Phase 6)** → can start after Foundational; profiles/fallbacks.
- **US5 (Phase 7)** → depends on US1/US2/US4 for config fields.
- **US6 (Phase 8)** → depends on implemented features and hardware.
- **Polish (Phase 9)** → depends on all desired stories.

### User Story Dependencies

- **US1 (P1)**: core builder; no dependency on other stories.
- **US2 (P1)**: requires US1 command infrastructure.
- **US3 (P2)**: requires US4 profile gating.
- **US4 (P2)**: profile/fallback independent of US2/US3.
- **US5 (P2)**: config/UI after US1/US2/US4.
- **US6 (P3)**: hardware after implementation.

### Parallel Opportunities

- T001–T003 test scaffolding.
- T008/T009 text vs 1D/raster.
- T014/T015 2D variants.
- T016 profiles vs T017 fallback vs T018 RFID.
- T019 UI vs T020 recommendation mapping.

## Parallel Example: US1

```text
T008  text/styles builder
T009  1D barcode + raster builder
```

## Implementation Strategy

### MVP First

1. Setup + Foundational (T001–T007).
2. US1 text/1D/image (T008–T011).
3. **STOP and VALIDATE**: golden + executor tests, manual 80 mm print.

### Incremental Delivery

1. US1 → core ESC/POS output.
2. US2 → controls.
3. US4 → profiles/fallback.
4. US3 → native/fallback 2D.
5. US5 → config/UI.
6. US6 → hardware matrix.

### TDD Rules

- Write the failing test first; confirm the failure reason.
- Implement the minimum to green; refactor with tests green.
- Never bypass the shared scene/plan/transport.
- A hardware-only behavior must be recorded in the matrix, not guessed.

## Notes

- ESC/POS command output is binary text; use binary segments for encoded text/raster.
- Do not add a second print executor or transport layer.
- Keep TSPL/ZPL/CPCL output byte-identical; the golden manifest must stay green.
- **2026-10-19 — implementation and automated verification complete.** ESC/POS
  builder/profiles/config/UI/engine dispatch implemented; golden fixture added; full gate
  350 tests / 85.82% lines / 7 E2E. Remaining open: T022 hardware matrix, T026 hardware
  questions, T027 commit.

---

description: "Task list for electronic scale weight capture"
---

# Tasks: Electronic Scale Weight Capture

**Input**: Design documents from `specs/008-electronic-scale/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`,
`quickstart.md`

**Tests**: Required (project constitution). Parser, units, IPC, lifecycle and renderer
tests are written and seen failing before implementation; each story adds its own
automated coverage.

**Organization**: Tasks are grouped by user story so each story is independently testable.
US1 is the MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: `[US1]` … `[US3]` for user-story phases only
- Every task names an exact file path or command

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Catalog keys and shared test scaffolding used by all stories.

- [X] T001 Add scale error/status keys (`error.scalePort`, `error.scaleFrame`, `error.scaleTimeout`, `error.scaleInvalid`, `error.scaleCustom`, `error.scaleBusy`, `error.invalidPayload`) to `app/src/shared/i18n/messages.zh-CN.ts` and `app/src/shared/i18n/messages.en-US.ts`.
- [X] T002 [P] Create scripted frame fixtures and an in-memory `ScaleTransport` fake in `app/tests/helpers/scale.ts` (stable/unstable/overload/underload/zero/negative/malformed/disconnected sequences).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared parser/units/transport/IPC/resolution infrastructure required by every
story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests first

- [X] T003 [P] Write failing protocol parser/stability tests in `app/tests/unit/shared/scale/parse.test.ts` for all 8 protocols, including KASDA/TONDE text and binary frames, custom ambiguity and malformed input.
- [X] T004 [P] Write failing unit conversion/formatting tests in `app/tests/unit/shared/scale/units.test.ts` for g/kg/lb/oz/jin, 0–4 decimals and unknown units.
- [X] T005 [P] Write failing IPC contract tests in `app/tests/contracts/scale-ipc.test.ts` for `scale:read`/`scale:cancel` payload validation, result shape, error keys and busy/cancel semantics.
- [X] T006 [P] Write failing integration tests in `app/tests/integration/main/scale.test.ts` for open/read/close, serialization, timeout/cancel port release and no stale reading, using the fake transport from T002.

### Implementation

- [X] T007 Create shared scale types in `app/src/shared/scale/types.ts` (`ScaleProtocol`, `WeighUnit`, `ScaleReading`, `ScaleStatus`, request/result types) per `data-model.md`.
- [X] T008 [P] Create the declarative protocol registry in `app/src/shared/scale/protocols.ts` with the 8 protocols and frame specs from `contracts/scale-protocols.md`.
- [X] T009 [P] Implement unit parsing/conversion/formatting in `app/src/shared/scale/units.ts` using exact factors (kg=1000 g, lb=453.59237 g, oz=28.349523125 g, jin=500 g) and 0–4 decimals.
- [X] T010 Implement frame parsing/stability validation in `app/src/shared/scale/parse.ts` (two equal stable frames required; reject unstable/overload/underload/zero/negative/malformed) so T003/T004 pass.
- [X] T011 Add the additive channel names and payload/result types to `app/src/shared/ipcContract.ts` (`scale:read`, `scale:test`, `scale:cancel`).
- [X] T012 Add scale payload validation to `app/src/main/ipc/validation.ts` (protocol enum, non-empty port 1–32 chars matching a serial-port shape, baud 2400/4800/9600/19200/38400, unit enum, decimals 0–4, timeout 1–30000 ms).
- [X] T013 Create the `ScaleTransport` interface and `serialport@13` implementation in `app/src/main/scale/transport.ts`, plus the scripted simulator in `app/src/main/scale/simulated.ts` selected by `MAXLABEL_SCALE_SIM`.
- [X] T014 Implement the read lifecycle in `app/src/main/scale/serialScale.ts` (one active read, queue/reject concurrent, timeout, cancel, close in `finally`) so T006 passes.
- [X] T015 Create `app/src/main/ipc/registerScaleIpc.ts` for `scale:read`/`scale:cancel` and register it in `app/src/main/index.ts`.
- [X] T016 Add the `scale` facade (`read`/`test`/`cancel`) to `app/src/preload/index.ts`, mapped only to the whitelisted channels.
- [X] T017 [P] Write failing document-normalization tests in `app/tests/unit/shared/domain/document-scale.test.ts` for `weighPort` 1–32 chars, protocol/unit enums, baud list and `weighDecimals` 0–4.
- [X] T018 Extend document normalization in `app/src/shared/domain/document.ts` to validate `weighPort` 1–32 chars, `weighProtocol`/`weighUnit` enums, `weighBaud` list and `weighDecimals` 0–4.
- [X] T019 [P] Write failing unit tests in `app/tests/unit/shared/scale/resolve.test.ts` for `scaleValues` per-label indexing, `keyboardValues` fallback and missing-index failure.
- [X] T020 Add optional `scaleValues?: Record<string, string[]>` to the data-source context and per-`labelIndex` keyboard resolution in `app/src/shared/domain/datasource.ts`.

**Checkpoint**: Parser/units/IPC/lifecycle tests pass; no UI wiring yet.

---

## Phase 3: User Story 1 - Weigh and print one label (Priority: P1) 🎯 MVP

**Goal**: Configure a weigh source, capture one stable weight and print it on a label,
with clear failure handling.

**Independent Test**: With the simulated transport, configure a weigh source, print one
label and verify the label contains the stable value; disconnect/timeout paths print no
label and show an actionable error.

### Tests

- [X] T021 [P] [US1] Write failing integration tests in `app/tests/integration/renderer/scale-print.test.ts` for per-label `scaleValues` resolution, exactly one read per logical label, no read reuse across jobs, and no `bumpSerial`/`logPrint` call on cancel or timeout.
- [X] T022 [P] [US1] Extend `app/tests/e2e/scale.spec.ts` with the single-label simulated flow (configure weigh source, print, assert label text; assert no label on disconnected/timeout).

### Implementation

- [X] T023 [US1] Implement `app/src/renderer/src/features/scale/resolveWeights.ts` to collect weigh sources, read one stable value per label, and produce `scaleValues`.
- [X] T024 [US1] Wire `resolveWeights` into `app/src/renderer/src/features/printing/usePrintWorkflow.ts`, `app/src/renderer/src/features/printing/usePreviewWorkflow.ts` (one sample read), and `app/src/renderer/src/features/printing/useCommandExportWorkflow.ts` before print/preview/export.
- [X] T025 [US1] Pass the resolved `scaleValues` through `app/src/renderer/src/App.tsx`, `app/src/renderer/src/features/printing/printExecutor.ts` and `app/src/renderer/src/features/printing/printJob.ts` (`createPrintContext`) into the print context.
- [X] T026 [US1] Surface port/frame/timeout/invalid-weight errors with catalog keys in `app/src/renderer/src/features/scale/resolveWeights.ts` and keep the document unchanged on failure.
- [X] T027 [US1] Ensure the weigh source UI in `app/src/renderer/src/dialogs/DataSourceEditor.tsx` reflects the configured state and does not prompt for manual input when the scale read succeeds.

**Checkpoint**: US1 works with the simulator; print output is unchanged apart from the weight.

---

## Phase 4: User Story 2 - Units, decimals and automatic printing (Priority: P2)

**Goal**: Convert/round weights to the configured unit and optionally print automatically
after a stable reading.

**Independent Test**: Capture the same simulated weight under different unit/decimal
configurations; enable auto-print and verify one print per stable weight, and stop/cancel
releases the port.

### Tests

- [X] T028 [P] [US2] Extend `app/tests/unit/shared/scale/units.test.ts` with 1.234 kg → 1.23 kg / 1234 g, lb/oz/jin conversion, decimals 0–4 and conversion-disabled cases.
- [X] T029 [P] [US2] Write failing auto-print loop tests in `app/tests/unit/renderer/scale/auto-print.test.ts` (one logical label per stable reading, the print count is ignored while auto-print is active, stop cancels the read, no print on unstable/error).
- [X] T030 [P] [US2] Extend `app/tests/e2e/scale.spec.ts` with unit conversion and auto-print scenarios.

### Implementation

- [X] T031 [US2] Apply `weighUnitConv`/`weighDecimals` in `app/src/renderer/src/features/scale/resolveWeights.ts` using `app/src/shared/scale/units.ts`; keep the printed string language-independent.
- [X] T032 [US2] Implement the auto-print loop in `app/src/renderer/src/features/scale/useAutoPrint.ts`: one stable reading prints exactly one logical label (copies-per-label applied), the print count is ignored while active, and the existing print action is reused.
- [X] T033 [US2] Add the auto-print start/stop control and status to `app/src/renderer/src/editor/PrintDock.tsx`, shown only when a weigh source has `weighAutoPrint`.
- [X] T034 [US2] Ensure stop/cancel aborts the pending read, releases the port and does not print a partial value.

**Checkpoint**: Units/decimals and auto-print work independently of US3.

---

## Phase 5: User Story 3 - Diagnostics, failure and manual fallback (Priority: P3)

**Goal**: Test the scale connection, show diagnostics, and fall back safely when the scale
is unavailable.

**Independent Test**: Use `scale:test` with each simulation mode; force overload/unstable/
malformed/disconnected reads and verify actionable messages, no corrupt label, and manual
keyboard fallback keeps the document printable.

### Tests

- [X] T035 [P] [US3] Extend `app/tests/contracts/scale-ipc.test.ts` and `app/tests/integration/main/scale.test.ts` for `scale:test`, overload/underload/zero/negative/malformed/disconnected and concurrent-read busy behavior.
- [X] T036 [P] [US3] Extend `app/tests/e2e/scale.spec.ts` for failure diagnostics, retry/cancel and switching back to keyboard input.

### Implementation

- [X] T037 [US3] Implement `scale:test` in `app/src/main/ipc/registerScaleIpc.ts` and `app/src/main/scale/serialScale.ts` with a bounded diagnostic window and port release.
- [X] T038 [US3] Add the test-connection UI and diagnostics display in `app/src/renderer/src/dialogs/DataSourceEditor.tsx` (port opened, raw frames, stable/invalid status).
- [X] T039 [US3] Implement retry/cancel/manual-fallback UX in `app/src/renderer/src/features/scale/resolveWeights.ts` and `app/src/renderer/src/editor/PrintDock.tsx` without losing the document or other data.
- [X] T040 [US3] Ensure cancellation on print cancel/tab close/app shutdown releases the port via `app/src/main/scale/serialScale.ts`.

**Checkpoint**: All three stories work independently; failures never print invalid values.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T041 [P] Update `app/tests/INDEX.md` and `app/tests/README.md` with the scale tests.
- [X] T042 Run the full gate: `npm test`, `npm run test:coverage`, and `env -u ELECTRON_RUN_AS_NODE npm run test:e2e`; record results in `specs/008-electronic-scale/quickstart.md`.
- [X] T043 Run the simulated manual validation (V-01–V-06) and record results in `specs/008-electronic-scale/quickstart.md`; update `spec.md`/`plan.md` only for confirmed changes.
- [X] T044 Commit with `git add specs/008-electronic-scale app && git commit`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → no dependencies.
- **Foundational (Phase 2)** → depends on Setup; blocks all stories.
- **US1 (Phase 3)** → depends on Foundational; MVP.
- **US2 (Phase 4)** → depends on Foundational and the resolution path from US1.
- **US3 (Phase 5)** → depends on Foundational and the US1 error path.
- **Polish (Phase 6)** → depends on the desired stories.

### Within Each User Story

- Tests first, seen failing, then implementation.
- Shared parsing/units before renderer resolution.
- Renderer resolution before auto-print.
- Error/diagnostic paths before manual fallback.
- No change to `PrintPlan`, protocol builders or template format.

### Parallel Opportunities

- T003–T006 (foundational tests).
- T008/T009 (protocol registry and units).
- T021/T022 and T028–T030 test additions.
- T035/T036 test additions.
- T041 documentation and T042 gate after implementation.

---

## Parallel Example: User Story 1

```text
T021  integration test: per-label scale values
T022  E2E: single-label simulated flow
```

---

## Implementation Strategy

### MVP First

1. Setup + Foundational (T001–T020).
2. US1 (T021–T027).
3. **STOP and VALIDATE**: one label prints the stable weight; failures print nothing.

### Incremental Delivery

1. US1 → single-label capture.
2. US2 → units/decimals/auto-print.
3. US3 → diagnostics and manual fallback.
4. Polish → full gate and simulated manual validation.

### Safety Rules

- Only stable readings are used; reject unstable/overload/underload/zero/negative/malformed.
- One serial connection and one read at a time; close the port on success/error/cancel.
- Do not print stale or partial values.
- Do not change `ResolvedPrintScene`, `PrintPlan`, protocol builders or template formats.
- Scale values are language-independent strings.
- Device-specific frames stay in `shared/scale/protocols.ts` with `TODO(device)` markers.

## Notes

- Real-device verification is deferred (no device available); the simulator and unit
  fixtures are the acceptance evidence for v1.
- The `custom` protocol is a strict tolerant parser, not a user-editable regex.
- Scale configuration is stored with the template; readings and diagnostics are not
  persisted.

---

## Phase 7: Convergence

- [X] T045 Add a shared single-operation guard so `scale:read` and `scale:test` cannot run concurrently (the second request returns `error.scaleBusy`) per `contracts/scale-ipc.md` / T014, with failing integration and contract tests first in `app/tests/integration/main/scale.test.ts` (`contradicts`).
- [X] T046 Emit `error.scaleFrame` when frames were received but none parsed, and `error.scaleCustom` for an ambiguous `custom` frame, instead of always reporting `error.scaleTimeout` per FR-012 and `contracts/scale-protocols.md`, with failing tests first in `app/tests/integration/main/scale.test.ts` and `app/src/main/scale/serialScale.ts` (`partial`).
- [X] T047 Cancel the in-flight scale read and print when its originating tab is closed, releasing the serial port per Edge Cases and T040, tracked from `app/src/renderer/src/App.tsx` (`partial`).
- [X] T048 Show `portOpened` and up to 10 raw frames from `scale:test` in the connection-test diagnostics in `app/src/renderer/src/dialogs/DataSourceEditor.tsx` per T038 and FR-010 (`partial`).

---

## Phase 8: Convergence

- [X] T049 Seed the weigh configuration (including `weighPort`) when a source switches to electronic scale and render the actual stored port instead of the `|| 'COM1'` display fallback, so the visible configuration matches what the reader opens per FR-001, T027 and the data-model `weighPort` rule (`contradicts`).
- [X] T050 Expose operation completion for preview and export and clear the tracked operation tab when they settle, so closing that tab afterwards does not call `cancelCurrentOperation` for a finished job per T047 (`partial`).

---

## Phase 9: Convergence

- [X] T051 Force electronic-scale auto-print to print exactly one logical label regardless of `autoCount`, `firstCopyAsk` or a global script's total-labels override, so one stable reading never prints extra labels with empty weights or opens an interactive prompt per reading per FR-006 / US2/AC2, with failing tests first in `app/tests/unit/renderer/scale/auto-print.test.ts` or `app/tests/integration/renderer/scale-print.test.ts` (`partial`).

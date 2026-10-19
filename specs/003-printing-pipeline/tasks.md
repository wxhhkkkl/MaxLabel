---
description: "Verification and documentation backlog for the as-is printing pipeline"
---

# Tasks: Printing Pipeline and Devices (As-Is)

**Input**: Design documents from `specs/003-printing-pipeline/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Required by the constitution, but this feature changes no runtime behavior.
Tasks verify existing behavior and record evidence; only tests/documentation are added.

**Organization**: Tasks are grouped by user story. No product code is changed; any defect
found is recorded and fixed in a separate change (FR-033 of 002).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files/commands)
- **[Story]**: `[US1]` … `[US6]` for user-story phases only
- Every task names an exact file path or command

## Phase 1: Setup (Verification Infrastructure)

**Purpose**: Set up the verification record for the as-is baseline.

- [x] T001 Create `specs/003-printing-pipeline/verification/baseline.md` with the commit hash, test file/test counts, coverage and E2E results.
- [x] T002 Create `specs/003-printing-pipeline/verification/hardware-matrix.md` with a manual template for brand/model, protocol, port, DPI, encoding, RFID and print-quality checks.
- [x] T003 Run the automated commands in `specs/003-printing-pipeline/quickstart.md` and record pass/fail in `verification/baseline.md`.

## Phase 2: Foundational (Evidence Index)

**Purpose**: Make every FR verifiable before story-level checks.

- [x] T004 [P] Create `specs/003-printing-pipeline/verification/fr-matrix.md` mapping FR-001–FR-082 to source files and test commands/results.
- [x] T005 [P] Verify the architecture invariants (no adapter data re-resolution, single geometry source) against `app/src/shared/print/scene.ts`, `plan.ts`, `engine.ts` and `tests/unit/shared/print/scene.test.ts`; record in `verification/invariants.md`.
- [x] T006 [P] Verify limits and error semantics (100000/99999/1000000, batch 24, payload caps) against `app/src/shared/print/limits.ts`, `plan.ts`, `printExecutor.ts` and the related tests; record in `verification/invariants.md`.

## Phase 3: User Story 1 - Windows 驱动打印 (Priority: P1)

**Goal**: Verify driver printing, copies, failure and test print.

**Independent Test**: `tests/integration/renderer/print-executor.test.ts` driver cases.

- [x] T007 [P] [US1] Run `npx vitest run --project integration tests/integration/renderer/print-executor.test.ts` and record the driver success/failure results.
- [x] T008 [US1] Verify count × copies, one system job and driver payload cap in `app/src/renderer/src/features/printing/printExecutor.ts`; record in `verification/fr-matrix.md`.
- [ ] T009 [US1] Verify test print outputs one label, writes no log and advances no serial; record the executor assertion and manual driver print check in `verification/hardware-matrix.md`.

**Checkpoint**: Driver behavior is documented and verified by tests + manual checklist.

## Phase 4: User Story 2 - 指令直连 TSPL/ZPL/CPCL (Priority: P1)

**Goal**: Verify protocol output, DPI, encoding and transport.

**Independent Test**: protocol unit tests, golden contract, transport integration.

- [x] T010 [P] [US2] Run `npx vitest run --project unit tests/unit/shared/print` for TSPL/ZPL/CPCL and device output; record results.
- [x] T011 [P] [US2] Run `npx vitest run --project contracts tests/contracts/protocol-golden.test.ts`; record byte/hash/token results.
- [x] T012 [P] [US2] Run `npx vitest run --project integration tests/integration/main/printing-transport.test.ts`; record TCP/USB/serial/LPT results.
- [x] T013 [US2] Verify 203/300/600 dpi conversion and physical-size invariance against `app/src/shared/print/geometry.ts` and the protocol tests; record in `verification/fr-matrix.md`.
- [x] T014 [US2] Verify UTF-8/GBK encoding paths in `app/src/main/printing/commandTransport.ts` and the transport tests; record in `verification/fr-matrix.md`.
- [ ] T015 [US2] Record real-device TSPL/ZPL/CPCL checks (text, Code128, QR, PDF417, image) in `verification/hardware-matrix.md`. **2026-10-19 partial**: Zenpert 4T530 (TSPL, USB001, 300 dpi, 60×40 mm) printed Code128/QR/PDF417/BOX/BAR; TEXT font 0, LINE and BITMAP polarity defects recorded in the matrix. ZPL/CPCL not tested.

**Checkpoint**: Three protocols and transport semantics are verified/documented.

## Phase 5: User Story 3 - 批量可变数据与打印计划 (Priority: P1)

**Goal**: Verify plan arithmetic, batching, serials and empty-DB blocking.

**Independent Test**: plan unit tests + executor batch/partial cases.

- [x] T016 [P] [US3] Run `npx vitest run --project unit tests/unit/shared/print/plan.test.ts`; record counts/copies/slots/dedupe/limits.
- [x] T017 [P] [US3] Verify the executor's 24-page batch, partial/unknown and empty-DB cases in `tests/integration/renderer/print-executor.test.ts`; record in `verification/fr-matrix.md`.
- [ ] T018 [US3] Verify serial advancement/writeback uses only confirmed labels (`printExecutor.ts`, `printJob.ts`); record the evidence and manual 25-label TCP batch check in `verification/hardware-matrix.md`.
- [x] T019 [US3] Verify copies do not advance serials and repeat/basis semantics in `tests/unit/shared/domain/datasource.test.ts`; record in `verification/fr-matrix.md`.

**Checkpoint**: Batch/serial behavior is documented with automated and manual evidence.

## Phase 6: User Story 4 - 能力降级与位图回退 (Priority: P2)

**Goal**: Verify faithful fallback and RFID/font handling.

**Independent Test**: capability/scene unit tests + render harness.

- [x] T020 [P] [US4] Run `npx vitest run --project unit tests/unit/shared/print/scene.test.ts tests/unit/shared/print/device-output.test.ts`; record capability, RFID, font and Chinese results.
- [x] T021 [US4] Run `env -u ELECTRON_RUN_AS_NODE npx playwright test tests/e2e/render-harness.spec.ts`; record pixel/cache/paper-shape results.
- [x] T022 [US4] Verify that a missing page bitmap blocks sending (`printExecutor.ts`, `scene.ts`); record in `verification/fr-matrix.md`.
- [ ] T023 [US4] Record manual unsupported-feature fallback and RFID checks in `verification/hardware-matrix.md`.

**Checkpoint**: Fallback and device-specific output are verified/documented.

## Phase 7: User Story 5 - 预览、测试打印、日志与取消 (Priority: P2)

**Goal**: Verify preview, log snapshot and cancellation/partial semantics.

**Independent Test**: preview E2E + executor tests.

- [x] T024 [P] [US5] Run `env -u ELECTRON_RUN_AS_NODE npx playwright test tests/e2e/print-preview.spec.ts`; record page count/image results.
- [x] T025 [P] [US5] Verify log fields and resolved-data snapshots in `app/src/shared/print/logSchema.ts` and `tests/integration/renderer/print-executor.test.ts`; record in `verification/fr-matrix.md`.
- [ ] T026 [US5] Verify canceled/unknown/partial statuses and sent counts in `commandTransport.ts`/`printExecutor.ts`; record manual disconnect/cancel checks in `verification/hardware-matrix.md`.

**Checkpoint**: Preview/log/cancel behavior is verified/documented.

## Phase 8: User Story 6 - 打印机配置与设备目录 (Priority: P3)

**Goal**: Verify configuration persistence, catalog recommendations and port validation.

**Independent Test**: catalog tests + IPC contract tests.

- [x] T027 [P] [US6] Run `npx vitest run --project unit tests/unit/shared/domain/printer-catalog.test.ts tests/unit/shared/domain/label-formats.test.ts`; record catalog/format results.
- [x] T028 [P] [US6] Run `npx vitest run --project contracts tests/contracts/ipc-contract.test.ts`; record port validation results.
- [ ] T029 [US6] Verify printer settings round-trip and brand recommendations in `PrinterSettings.tsx`/`printer.ts`; record manual settings persistence in `verification/hardware-matrix.md`.

**Checkpoint**: Printer configuration behavior is verified/documented.

## Phase 9: Polish & Cross-Cutting Concerns

- [x] T030 Run the full gate: `npm test`, `npm run test:coverage`, `npm run test:e2e`; record results in `verification/baseline.md`.
- [x] T031 Resolve or re-confirm Q-001–Q-005 with the owner (ESC/POS, China Post, hardware matrix, cross-platform, bitmap limits); update `specs/003-printing-pipeline/spec.md` and `specs/003-printing-pipeline/research.md`.
- [x] T032 Review the matrix against the constitution: every FR has evidence; no product behavior changed; no test depends on `parity/`/`app/docs`.
- [x] T033 Commit `specs/003-printing-pipeline/` and verification artifacts with `git add specs/003-printing-pipeline && git commit`. **Done**: committed in `54ccb9c`.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → no dependencies.
- **Foundational (Phase 2)** → depends on Setup; T004–T006 block story verification records.
- **US1–US6** → depend on Foundational; can run in parallel by story.
- **Polish (Phase 9)** → depends on desired stories.

### User Story Dependencies

- **US1 (P1)**: driver path; no dependency on other stories.
- **US2 (P1)**: native protocols/transport; no dependency on US1.
- **US3 (P1)**: plan/batch/serials; independent of US1/US2.
- **US4 (P2)**: fallback; depends on scene/capability tests only.
- **US5 (P2)**: preview/log/cancel; independent.
- **US6 (P3)**: config/catalog; independent.

### Parallel Opportunities

- T004–T006 evidence/invariant docs.
- T007–T009 (US1), T010–T015 (US2), T016–T019 (US3), T020–T023 (US4),
  T024–T026 (US5), T027–T029 (US6) can be split across reviewers.
- T010, T011, T012 are independent commands and can run in parallel.

## Parallel Example: US2

```text
T010  protocol unit tests
T011  golden contract test
T012  transport integration tests
```

## Implementation Strategy

### Documentation-First Baseline

1. Complete Setup + Foundational (T001–T006).
2. Verify US1–US6 in parallel, recording automated and manual evidence.
3. **STOP and REVIEW**: every FR has an evidence row; open questions are explicit.
4. Commit documentation/verification only; no product changes.

### During Verification

- Do not “fix” behavior silently; record it first and create a separate change.
- Use the quickstart commands exactly; record full command + result.
- Manual hardware checks must name brand/model/firmware/DPI/encoding.
- Never claim a protocol output is verified without a real device or golden evidence.

## Notes

- `[P]` tasks have different files/commands and can run in parallel.
- This feature produces documentation/verification artifacts, not new runtime code.
- Hardware checks are opt-in and cannot block the fast gate.
## Progress Log

- **2026-10-18 — T001–T006 complete.**
  - Quickstart: unit print 6 files/37 tests; golden 1/4; integration 2/13; E2E 2 passed.
  - `verification/baseline.md`, `hardware-matrix.md`, `fr-matrix.md`,
    `invariants.md` created.
  - FR matrix: 20 `auto`, 10 `partial`, 3 `review`, 1 `manual`; explicit gaps recorded
    for payload/limit boundaries, GBK, file merge, Bluetooth/file ports, bitmap-blocking,
    on-disk JSONL, multi-batch cancel and temp cleanup.
- **2026-10-18 — automated verification complete.** 330 tests / 85.23% lines; 7 E2E.
  Closed direct gaps for limits, GBK, file merge, bitmap blocking and multi-batch
  cancel. Remaining open tasks are manual hardware/device checks, owner questions and
  the final commit.
- **2026-10-19 — commit task reconciled.** `54ccb9c` contains this spec and the
  verification artifacts; T033 is closed. Remaining open: manual checks in
  T009/T015/T018/T023/T026/T029.
- **2026-10-19 — partial real-device TSPL check.** Zenpert 4T530 (300 dpi, USB001,
  60×40 mm gap labels). Code128/QR/PDF417/BOX/BAR pass; three TSPL output defects found
  (font 0 sizing, unsupported `LINE`, `BITMAP` polarity) and recorded in
  `verification/hardware-matrix.md`. No product code changed; remaining checks were not
  run per owner decision.

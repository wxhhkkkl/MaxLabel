---
description: "Verification and documentation backlog for the as-is baseline"
---

# Tasks: MaxLabel Desktop System Baseline (As-Is)

**Input**: Design documents from `specs/001-system-baseline/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`

**Tests**: Required. The project constitution makes TDD non-negotiable. Because this is a
brownfield baseline, the first task restores the existing regression suite; subsequent
tasks verify current behavior and add tests where coverage is missing.

**Note**: This backlog does not authorize rebuilding existing features. Tasks marked
"verify" mean run/inspect the current implementation and record the result; only tests and
documentation are expected to be added.

## Phase 1: Setup (Restore the TDD Gate)

**Purpose**: The test harness was removed from `main` on 2026-10-18. No new feature or
defect fix may proceed until this phase is complete.

- [x] T001 Restore `app/scripts/` and `app/fixtures/` from `parity` (`546f151`) with
  `git checkout parity -- app/scripts app/fixtures`, then inspect differences against the
  current source. **Done 2026-10-18** (143 files restored).
- [x] T002 Re-add a `test` script and the required `test:*` entries in
  `app/package.json`, adapted to the restored suite. **Done 2026-10-18**; `dist` scripts
  remain intentionally omitted.
- [x] T003 Run the restored suite (`npm test`) and record failures caused by source drift
  instead of hiding/skipping them. **Done 2026-10-18.** Two issues found:
  (a) protocol fixtures were inflated by CRLF checkout (`core.autocrlf=true`), causing
  TSPL/ZPL byte-count mismatches; (b) Electron-based tests cannot start when
  `ELECTRON_RUN_AS_NODE=1` is set in the environment. After fixing (a) and unsetting the
  variable for the test command, the full suite passes.
- [x] T004 Fix or explicitly quarantine only the drift unrelated to this baseline, with
  owner approval for each quarantine (evidence rule). **Done 2026-10-18**; added
  `.gitattributes` to keep `app/fixtures/protocol/**` byte-exact. No test in the `npm test`
  gate was quarantined.

**Checkpoint**: `npm test` runs and the TDD gate is usable. **Passed 2026-10-18.**

**Removed on 2026-10-18 (owner decision)**: all UI alignment scripts
(98 × `ui-v*.cjs`, `ui-smoke.cjs`, `ui-verify.mjs`, `run-regression.ps1`) and the
parity-dependent evidence/generator scripts (`matrix-evidence.test.cjs`,
`generate-label-formats.cjs`, `generate-printer-catalog.cjs`, `runner-safety.test.cjs`).
They remain available on the `parity` branch if needed.

**Quarantined optional scripts (not part of `npm test`)** — they depend on artifacts that
were removed during the repository cleanup; restoring them is an owner decision:

| Script | Missing dependency |
|--------|--------------------|
| `test:license` | `app/docs/labelshop-compatibility-audit.md` |
| `test:installer` | `app/build/license_zh_CN.txt` |

---

## Phase 2: Foundational (Evidence Index)

**Purpose**: Make every FR verifiable before story-level validation.

- [x] T005 [P] Cross-check all 38 `FR-###` evidence paths in `spec.md` against the
  current tree; record any path that no longer exists. **Done 2026-10-19**: all 38 FRs
  carry `Evidence:`; the 36 unique paths resolve (one is relative to
  `app/src/renderer/src`). No missing path.
- [ ] T006 [P] For FRs without automated coverage, list the manual verification scenario
  in `quickstart.md` that covers them.
- [ ] T007 Record the documentation debt from `app/docs/` (parity branch) and decide what
  should be re-published under `specs/` or `app/docs/` (owner decision, no invention).

**Checkpoint**: Every FR has either a test reference or an explicit manual scenario.

---

## Phase 3: User Story 1 - 设计并打印一张标签 (Priority: P1)

**Goal**: Verify the core edit → preview → print path.

**Independent Test**: `quickstart.md` V-01.

- [x] T008 [P] [US1] Add/restore a rendering test covering a text + barcode label through
  `resolvePrintScene` and the preview scene. **Covered by 002**: `tests/unit/shared/print/scene.test.ts`
  and `tests/e2e/render-harness.spec.ts`.
- [ ] T009 [P] [US1] Verify object creation, transform, rotation and property editing in
  `features/editor/operations.ts` and `useEditorTransformCommands.ts`.
- [ ] T010 [US1] Verify image insertion and table configuration against
  `shared/domain/objects.ts`.
- [ ] T011 [US1] Verify millimetre coordinates, zoom, grid and rulers in
  `editor/LabelEditor.tsx`.

**Checkpoint**: V-01 passes and the rendering test is green.

---

## Phase 4: User Story 2 - 批量可变数据打印 (Priority: P1)

**Goal**: Verify all seven data sources, serial advancement and print counts.

**Independent Test**: `quickstart.md` V-02.

- [x] T012 [P] [US2] Restore/port the data-source unit tests from
  `parity:app/scripts/` (serial, date/time, substring/format, database). **Covered by
  002**: `tests/unit/shared/domain/datasource.test.ts` and
  `tests/integration/main/db.test.ts`.
- [ ] T013 [P] [US2] Add a test proving `PrintPlan` advances records and copies correctly
  for 10 rows (`shared/print/plan.ts`).
- [ ] T014 [US2] Verify keyboard-input ordering and electronic-scale options against
  `dialogs/KeyInputOrderDialog.tsx` and `shared/domain/datasource.ts`.
- [ ] T015 [US2] Verify script lifecycle hooks and forbidden-identifier rejection in
  `shared/domain/scriptRuntime.ts`; add a test if the restored suite lacks one.
- [ ] T016 [US2] Verify that the print log uses the resolved snapshot and does not
  re-evaluate scripts (no duplicate side effects).

**Checkpoint**: V-02 passes; plan/serial tests are green.

---

## Phase 5: User Story 3 - 多文档、保存与模板复用 (Priority: P2)

**Goal**: Verify multi-tab isolation, safe saves, local/cloud templates and export.

**Independent Test**: `quickstart.md` V-03.

- [x] T017 [P] [US3] Restore/port document history and workspace regression tests.
  **Covered by 002**: `tests/unit/renderer/document-history.test.ts` and
  `tests/e2e/workspace-harness.spec.ts`.
- [ ] T018 [P] [US3] Verify duplicate-path save rejection and close-confirmation
  behaviour in `documentPersistence.ts`.
- [ ] T019 [US3] Verify `.msdx` envelope round-trip, legacy JSON, migration and secret
  redaction (`io/msdx.ts`, `shared/domain/document.ts`).
- [ ] T020 [US3] Verify `.lsdx` import with embedded images using the existing fixture
  (`fixtures/lsdx/minimal.lsdx`, parity branch).
- [ ] T021 [US3] Verify barcode export naming and transactional writes in
  `main/barcodeExport.ts` and `features/exporting/barcodeExport.ts`; add a test.

**Checkpoint**: V-03 passes; template round-trip and export tests are green.

---

## Phase 6: User Story 4 - 指令直连与多品牌打印机 (Priority: P2)

**Goal**: Verify protocol output, port selection and bitmap fallback.

**Independent Test**: `quickstart.md` V-04 (hardware required for the final transport step).

- [x] T022 [P] [US4] Restore/port `print-engine.test.ts` and the protocol fixtures
  (`fixtures/protocol/*`). **Covered by 002**: `tests/contracts/protocol-golden.test.ts`,
  `tests/unit/shared/print/*` and `app/fixtures/protocol/*`.
- [ ] T023 [P] [US4] Verify TSPL/ZPL/CPCL snapshots and 203/300/600 dpi conversion.
- [ ] T024 [US4] Verify bitmap fallback triggers for unsupported rotation/ellipse/colour
  and that sending is blocked when the bitmap is not ready.
- [x] T025 [US4] Verify printer settings persist with the template and that brand/profile
  selection does not introduce business-level brand branches. **Done 2026-10-19**:
  verified through 003 T029 (template + default preference persistence); brand/profile
  recommendations are covered by `printer-catalog`/`printer-escpos` tests.
- [ ] T026 [US4] Verify cancel semantics for an in-flight batch and the resulting
  `partial`/`unknown` log status.

**Checkpoint**: Protocol snapshots pass; hardware checks documented in V-04.

---

## Phase 7: User Story 5 - 授权激活与离线可用 (Priority: P2)

**Goal**: Verify activation, caching and offline editing policy.

**Independent Test**: `quickstart.md` V-05.

- [x] T027 [P] [US5] Restore/port the license tests from `parity:app/scripts/`.
  **Covered by 002**: `tests/integration/main/license.test.ts` and
  `tests/e2e/offline-license.spec.ts`.
- [ ] T028 [US5] Verify that an invalid/unreachable license server never blocks local
  editing or saving (`useLicenseStartup.ts`).
- [ ] T029 [US5] Verify machine binding and that a failed re-check preserves the cached
  license.
- [ ] T030 [US5] Verify update-check behaviour, including the missing `/api/version`
  server route, and record it as a known gap.

**Checkpoint**: V-05 passes; license policy is covered by tests.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T031 [P] Run `npm run typecheck` and the restored `npm test`; record results.
  **Done 2026-10-18**: typecheck passes; full suite exits 0 (requires
  `ELECTRON_RUN_AS_NODE` to be unset for the Electron-based tests).
- [x] T032 [P] Update `quickstart.md` with any deviations found during validation.
  **Done 2026-10-18**: documented CRLF fixtures and the `ELECTRON_RUN_AS_NODE` caveat.
- [ ] T033 [P] Resolve or re-confirm the `TODO(待确认)` items with the owner and update
  `spec.md` / `research.md`.
- [ ] T034 Review the baseline against the constitution and record any remaining
  non-compliance.
- [x] T035 Commit the documentation set and the restored harness; do not mix behavioral
  changes into this commit. **Done**: `specs/001-system-baseline/` was committed in
  `679e022`; no product behavior changed.

---

## Dependencies & Execution Order

- Phase 1 blocks every other phase (TDD gate).
- Phase 2 can run in parallel with Phase 1 once T001 is done.
- US1 and US2 are both P1 and can proceed in parallel after Phase 1.
- US3–US5 can start after Phase 1; hardware-dependent checks in US4 may run later.
- Phase 8 depends on the chosen stories being validated.

## Notes

- `[P]` tasks touch different files or can be verified independently.
- Do not "fix" a behavior during verification unless the owner confirms it is a defect;
  record it first, then create a separate change.
- Old documentation and tests are intentionally read from `parity` (`546f151`); do not
  copy wholesale without checking it still matches the current source.

## Reconciliation Note (2026-10-19)

- T005/T025 are closed with evidence.
- T008/T012/T017/T022/T027 are satisfied by the 002 test architecture; the legacy
  `parity:app/scripts` suite was intentionally removed on 2026-10-18.
- Remaining tasks are verification records or owner decisions: T006/T007, T009–T011,
  T013–T016, T018–T021, T023/T024, T026, T028–T030, T033/T034.

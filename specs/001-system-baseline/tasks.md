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
- [x] T006 [P] For FRs without automated coverage, list the manual verification scenario
  in `quickstart.md` that covers them. **Done 2026-10-19**: added the
  FR → Manual Scenario Map to `quickstart.md` (FR-003/012/013/015/024/037/051/052/053/061)
  and added recent-template and RFID steps to V-03/V-04.
- [x] T007 Record the documentation debt from `app/docs/` (parity branch) and decide what
  should be re-published under `specs/` or `app/docs/` (owner decision, no invention).
  **Done 2026-10-19**: debt inventory is `architecture.md` (87 lines),
  `labelshop-compatibility-audit.md` (89 lines) and 396 `labelshop-help-zh` assets.
  Owner decision: update FR-030 evidence to the current 003 specs and keep both documents
  plus the help assets on `parity` as historical reference; do not republish stale docs.

**Checkpoint**: Every FR has either a test reference or an explicit manual scenario.

---

## Phase 3: User Story 1 - 设计并打印一张标签 (Priority: P1)

**Goal**: Verify the core edit → preview → print path.

**Independent Test**: `quickstart.md` V-01.

- [x] T008 [P] [US1] Add/restore a rendering test covering a text + barcode label through
  `resolvePrintScene` and the preview scene. **Covered by 002**: `tests/unit/shared/print/scene.test.ts`
  and `tests/e2e/render-harness.spec.ts`.
- [x] T009 [P] [US1] Verify object creation, transform, rotation and property editing in
  `features/editor/operations.ts` and `useEditorTransformCommands.ts`. **Verified
  2026-10-19**: `tests/unit/renderer/operations.test.ts` covers align/distribute/resize/
  group/rotate/bounds and resize constraints; `editor-geometry.test.ts` covers
  Fabric↔model group transforms; `workspace-harness.spec.ts` covers workspace behavior;
  property fields reviewed in `PropertyPanel.tsx`/`ObjectPropsDialog.tsx`.
- [x] T010 [US1] Verify image insertion and table configuration against
  `shared/domain/objects.ts`. **Verified 2026-10-19**: image/table models in
  `shared/domain/objects.ts`; `scene.test.ts`/`device-output.test.ts` cover image and
  table output; `render-harness.spec.ts` covers image/table pixels; UI configuration
  reviewed in `ObjectPropsDialog.tsx`.
- [x] T011 [US1] Verify millimetre coordinates, zoom, grid and rulers in
  `editor/LabelEditor.tsx`. **Verified 2026-10-19**: `workspace-harness.spec.ts` asserts
  rulers/fit/zoom/paper clipping; `units.test.ts` covers mm/DPI conversion; editor
  coordinates reviewed in `LabelEditor.tsx`.

**Checkpoint**: V-01 passes and the rendering test is green.

---

## Phase 4: User Story 2 - 批量可变数据打印 (Priority: P1)

**Goal**: Verify all seven data sources, serial advancement and print counts.

**Independent Test**: `quickstart.md` V-02.

- [x] T012 [P] [US2] Restore/port the data-source unit tests from
  `parity:app/scripts/` (serial, date/time, substring/format, database). **Covered by
  002**: `tests/unit/shared/domain/datasource.test.ts` and
  `tests/integration/main/db.test.ts`.
- [x] T013 [P] [US2] Add a test proving `PrintPlan` advances records and copies correctly
  for 10 rows (`shared/print/plan.ts`). **Done 2026-10-19**: added
  `advances 10 database rows and serials in order` to `tests/unit/shared/print/plan.test.ts`
  (recordIndex 0–9, `serialAdvanceCount` 10).
- [x] T014 [US2] Verify keyboard-input ordering and electronic-scale options against
  `dialogs/KeyInputOrderDialog.tsx` and `shared/domain/datasource.ts`. **Verified
  2026-10-19**: `tests/unit/renderer/key-input-order.test.ts` covers unique label
  collection (groups/sub-sources) and saved-order merging; electronic-scale options are
  config-only in `DataSourceEditor.tsx`/`MoreDialogs.tsx`. Serial acquisition is not
  implemented (recorded in Baseline Notes).
- [x] T015 [US2] Verify script lifecycle hooks and forbidden-identifier rejection in
  `shared/domain/scriptRuntime.ts`; add a test if the restored suite lacks one.
  **Verified 2026-10-19**: `tests/unit/shared/domain/scriptRuntime.test.ts` covers
  lifecycle hooks, shared state, unsafe-program rejection and quotas.
- [x] T016 [US2] Verify that the print log uses the resolved snapshot and does not
  re-evaluate scripts (no duplicate side effects). **Verified 2026-10-19**: the executor
  records `resolvedSnapshots` from the resolved scenes and passes them to `logPrint`
  (`printExecutor.ts`); `scene.test.ts` verifies the snapshot keeps only the current row
  and metadata, so logging cannot re-run sources.

**Checkpoint**: V-02 passes; plan/serial tests are green.

---

## Phase 5: User Story 3 - 多文档、保存与模板复用 (Priority: P2)

**Goal**: Verify multi-tab isolation, safe saves, local/cloud templates and export.

**Independent Test**: `quickstart.md` V-03.

- [x] T017 [P] [US3] Restore/port document history and workspace regression tests.
  **Covered by 002**: `tests/unit/renderer/document-history.test.ts` and
  `tests/e2e/workspace-harness.spec.ts`.
- [x] T018 [P] [US3] Verify duplicate-path save rejection and close-confirmation
  behaviour in `documentPersistence.ts`. **Verified 2026-10-19**:
  `tests/unit/renderer/documentPersistence.test.ts` covers serialized saves,
  duplicate-path rejection, close confirmation and changes made while a dialog is open.
- [x] T019 [US3] Verify `.msdx` envelope round-trip, legacy JSON, migration and secret
  redaction (`io/msdx.ts`, `shared/domain/document.ts`). **Verified 2026-10-19**:
  `tests/contracts/template-format.test.ts` covers the envelope, legacy bare JSON and
  password redaction; `tests/unit/shared/domain/document.test.ts` covers migration and
  normalization.
- [x] T020 [US3] Verify `.lsdx` import with embedded images using the existing fixture
  (`fixtures/lsdx/minimal.lsdx`, parity branch). **Verified 2026-10-19**: added an
  embedded PNG object to the fixture; `tests/contracts/lsdx-import.test.ts` asserts an
  `ImageObj` with `imgType:'embed'`, and the Chromium E2E harness performs the real image
  decode/validation.
- [x] T021 [US3] Verify barcode export naming and transactional writes in
  `main/barcodeExport.ts` and `features/exporting/barcodeExport.ts`; add a test.
  **Verified 2026-10-19**: `tests/unit/renderer/barcode-export.test.ts` covers
  serial/content/content+serial naming, padding and sanitization;
  `tests/integration/main/barcode-export.test.ts` covers transactional writes, rollback
  and path-escape rejection.

**Checkpoint**: V-03 passes; template round-trip and export tests are green.

---

## Phase 6: User Story 4 - 指令直连与多品牌打印机 (Priority: P2)

**Goal**: Verify protocol output, port selection and bitmap fallback.

**Independent Test**: `quickstart.md` V-04 (hardware required for the final transport step).

- [x] T022 [P] [US4] Restore/port `print-engine.test.ts` and the protocol fixtures
  (`fixtures/protocol/*`). **Covered by 002**: `tests/contracts/protocol-golden.test.ts`,
  `tests/unit/shared/print/*` and `app/fixtures/protocol/*`.
- [x] T023 [P] [US4] Verify TSPL/ZPL/CPCL snapshots and 203/300/600 dpi conversion.
  **Verified 2026-10-19**: `tests/unit/shared/print/{tspl,zpl,cpcl}.test.ts` and
  `protocol-golden.test.ts` cover the three protocols; `tests/unit/shared/units.test.ts`
  covers `mm2dot`/`dot2mm` at 203/300/600 dpi.
- [x] T024 [US4] Verify bitmap fallback triggers for unsupported rotation/ellipse/colour
  and that sending is blocked when the bitmap is not ready. **Verified 2026-10-19**:
  `scene.test.ts` flags dynamic colour/advanced barcode options for rasterization;
  `device-output.test.ts` covers images/Chinese fallback; `print-executor.test.ts` blocks
  native output when the required page bitmap is unavailable.
- [x] T025 [US4] Verify printer settings persist with the template and that brand/profile
  selection does not introduce business-level brand branches. **Done 2026-10-19**:
  verified through 003 T029 (template + default preference persistence); brand/profile
  recommendations are covered by `printer-catalog`/`printer-escpos` tests.
- [x] T026 [US4] Verify cancel semantics for an in-flight batch and the resulting
  `partial`/`unknown` log status. **Verified 2026-10-19**: `print-executor.test.ts`
  covers unknown results, partial batches and cancel-before-next-batch; the Zenpert
  4T530 hardware cancel check is recorded in 003's hardware matrix.

**Checkpoint**: Protocol snapshots pass; hardware checks documented in V-04.

---

## Phase 7: User Story 5 - 授权激活与离线可用 (Priority: P2)

**Goal**: Verify activation, caching and offline editing policy.

**Independent Test**: `quickstart.md` V-05.

- [x] T027 [P] [US5] Restore/port the license tests from `parity:app/scripts/`.
  **Covered by 002**: `tests/integration/main/license.test.ts` and
  `tests/e2e/offline-license.spec.ts`.
- [x] T028 [US5] Verify that an invalid/unreachable license server never blocks local
  editing or saving (`useLicenseStartup.ts`). **Verified 2026-10-19**:
  `tests/integration/main/license.test.ts` covers invalid/unreachable servers and cached
  state; `tests/e2e/offline-license.spec.ts` edits and saves locally with no reachable
  license server.
- [x] T029 [US5] Verify machine binding and that a failed re-check preserves the cached
  license. **Verified 2026-10-19**: `license.test.ts` asserts activation sends
  `machine_id`, persists the cache, keeps it on a failed re-check, refreshes it on
  success and marks it inactive when the server rejects the license.
- [x] T030 [US5] Verify update-check behaviour, including the missing `/api/version`
  server route, and record it as a known gap. **Verified 2026-10-19**: added
  `tests/unit/main/updater.test.ts` (version compare, manifest parse, URL resolution,
  update/latest/404/network → `unavailable`); the missing `/api/version` route remains
  recorded in `spec.md` Baseline Notes.

**Checkpoint**: V-05 passes; license policy is covered by tests.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T031 [P] Run `npm run typecheck` and the restored `npm test`; record results.
  **Done 2026-10-18**: typecheck passes; full suite exits 0 (requires
  `ELECTRON_RUN_AS_NODE` to be unset for the Electron-based tests).
- [x] T032 [P] Update `quickstart.md` with any deviations found during validation.
  **Done 2026-10-18**: documented CRLF fixtures and the `ELECTRON_RUN_AS_NODE` caveat.
- [x] T033 [P] Resolve or re-confirm the `TODO(待确认)` items with the owner and update
  `spec.md` / `research.md`. **Done 2026-10-19**: owner confirmed general SMEs, mixed
  label sizes/batches per customer template, and bilingual UI as a future target. The
  current UI remains Chinese-only; this is recorded as a Baseline Note, not as
  implemented behavior. The performance TODO is resolved as "no product SLO". Q-005
  (cloud database routes / `/api/version` after the server rewrite) remains a separate
  product decision recorded in `research.md`; it does not block the as-is baseline.
- [x] T034 Review the baseline against the constitution and record any remaining
  non-compliance. **Done 2026-10-19**: no process-boundary, IPC-validation or
  duplicate-geometry violations found; remaining gaps are explicit Baseline Notes
  (bilingual UI, electronic-scale acquisition, cloud database routes, `/api/version`).
  Recorded in `plan.md`'s post-baseline review.
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

- All 35 baseline tasks are closed. T005/T025 have evidence; T008/T012/T017/T022/T027
  are satisfied by the 002 test architecture (the legacy `parity:app/scripts` suite was
  intentionally removed on 2026-10-18).
- New verification tests added during this pass: 10-row print plan, keyboard ordering,
  embedded LSDX image, and updater behavior.
- The baseline remains as-is: bilingual UI, electronic-scale acquisition, cloud database
  routes and `/api/version` are documented gaps in `spec.md` Baseline Notes, not claims.

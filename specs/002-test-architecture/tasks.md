---
description: "Task list for the test architecture rebuild"
---

# Tasks: Test Architecture Rebuild

**Input**: Design documents from `specs/002-test-architecture/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Required. This feature delivers tests, so every user-story phase produces test
files. For core suites, verify the test actually fails when the covered behavior is
temporarily broken (mutation check), then revert.

**Organization**: Tasks are grouped by user story so each layer can be built and validated
independently. The legacy suite remains runnable (`test:legacy`) until the equivalence
inventory is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: `[US1]` … `[US5]` for user-story phases only
- Every task names an exact file path or command

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the new runners, configuration and scripts without deleting the legacy
suite.

- [x] T001 Add devDependencies to `app/package.json`: `vitest@5.0.5`, `@vitest/coverage-v8@5.0.5`, `@playwright/test@1.64.1`, `jsdom@^26.1.0`, and bump `@types/node` to `^22`; run `npm install` and verify `npx vitest --version` and `npx playwright --version`.
- [x] T002 [P] Create `app/vitest.config.ts` with `unit`, `contracts` and `integration` projects, aliases (`@`, `@shared`, `@main`), coverage include/exclude, and exclusions for `tests/e2e`, `app/scripts`, `out`, `release`, `node_modules`.
- [x] T003 [P] Create `app/tsconfig.test.json` extending `tsconfig.node.json` with DOM libs, `jsx: react-jsx`, path aliases and `include: ["tests/**/*.ts","tests/**/*.tsx", "vitest.config.ts","playwright.config.ts"]`.
- [x] T004 [P] Create `app/playwright.config.ts` with `testDir: 'tests/e2e'`, 60 s timeout, `workers: 1`, CI retries, and HTML/list reporters.
- [x] T005 [P] Create the test tree `app/tests/{unit,contracts,integration,e2e,helpers,fixtures}` and add `app/coverage/`, `app/test-results/`, `app/playwright-report/` to `.gitignore`.
- [x] T006 Update `app/package.json` scripts: add `test:unit`, `test:integration`, `test:coverage`, `test:e2e`, `test:e2e:headed`, `test:release`, `typecheck:test`; move the current `test` chain to `test:legacy`; make `test` = typecheck + typecheck:test + `vitest run`.
- [x] T007 [P] Create `app/tests/helpers/tempDir.ts` (OS temp dirs with cleanup) and `app/tests/helpers/factories.ts` (sample document, printer config, tiny mono bitmap, fixed `DataCtx` clock) based on the legacy factories in `app/scripts/print-engine.test.ts`.
- [x] T008 [P] Create `app/tests/helpers/electronMock.ts` covering `app.getPath`, `app.getAppPath`, `safeStorage`, `dialog`, `ipcMain`, `BrowserWindow`, `shell`, `nativeImage`, `clipboard`, and `ClipboardItem`; export a `resetElectronMock()`.
- [x] T009 Verify the empty architecture: run `npm run typecheck`, `npm run typecheck:test`, `npm test` and confirm the fast suite exits 0 (empty suite allowed) while `npm run test:legacy` still passes.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the equivalence inventory, prove the Electron path works, and add
the CI/coverage skeleton. No user-story suite can be retired until T010 is complete.

- [x] T010 Create `app/tests/LEGACY-ASSERTIONS.md` mapping every P1 behavior from the inventory (PRINT-1..16, DATA-1..9, DOC-1..7, EDIT-1..7, IPC-1, BARC-1, COLOR-1) to a new test file or an explicit `retire` decision; include legacy file and test name.
- [x] T011 [P] Implement the P0 Playwright Electron spike in `app/tests/e2e/spike.spec.ts`: build, launch `out/main/index.js`, open the first window, screenshot, verify a temp `--user-data-dir`, force-exit within 20 s. Record the result (and Playwright/Electron compatibility) in `research.md`.
- [x] T012 [P] Add coverage configuration to `app/vitest.config.ts`: v8 provider, include `src/shared/domain/**` and `src/shared/print/**`, exclude `**/*.generated.ts` and re-export-only files, thresholds `lines: 80`.
- [x] T013 [P] Add the CI skeleton to `.github/workflows/ci.yml` with `fast`, `e2e`, `legacy` and `release` jobs, npm/Electron caches, `timeout-minutes`, and artifact uploads; keep the current build/typecheck steps.
- [x] T014 Run a mutation check on one core suite: temporarily break a print-plan branch, confirm the new test (added later) fails, then revert; document the procedure in `app/tests/README.md` (created in T054).

**Checkpoint**: The runner, Electron spike, coverage and CI skeleton are ready; the
equivalence inventory exists. User-story work can begin.

## Phase 3: User Story 1 - 统一、可靠的快速测试门禁 (Priority: P1) 🎯 MVP

**Goal**: `npm test` is the single, reliable fast gate.

**Independent Test**: On a clean checkout, `npm test` runs unit/contracts/integration
tests, prints a standard summary, exits non-zero on failure, and finishes in under 2
minutes (quickstart).

- [x] T015 [P] [US1] Add `app/tests/unit/shared/units.test.ts` covering mm↔px↔DPI conversions and the 203/300/600 dpi formulas as the runner smoke test.
- [x] T016 [P] [US1] Add `app/tests/unit/shared/table.test.ts` covering table merge/segment helpers and `keepSize` defaults.
- [x] T017 [US1] Add a deliberate failing assertion in a temporary test, confirm `npm test` returns non-zero and the output names the file/test, then remove it.
- [x] T018 [US1] Measure `npm test` runtime on the development machine and in the CI fast job; record the result in `app/tests/README.md` (T054) and fail the job if it exceeds 2 minutes.
- [x] T019 [US1] Confirm `npm test` touches no network, printer, Electron window, `parity/` or `app/docs`; document the check in `app/tests/README.md`.

**Checkpoint**: The fast gate is usable and reliably fails/passes.

## Phase 4: User Story 2 - 核心领域行为全量重建 (Priority: P1)

**Goal**: Rebuild the highest-risk domain tests on Vitest with the legacy suite as the
oracle.

**Independent Test**: Every PRINT/DATA/DOC/EDIT P1 assertion in
`LEGACY-ASSERTIONS.md` maps to a new test file; the new tests pass; the old suite still
passes.

- [x] T020 [P] [US2] Port the print scene/plan assertions (PRINT-1..6, 13–14) to `app/tests/unit/shared/print/scene.test.ts` and `plan.test.ts`; read `fixtures/protocol` as `Buffer`.
- [x] T021 [P] [US2] Port TSPL/ZPL/CPCL command assertions (PRINT-7..10, 15–16) to `app/tests/unit/shared/print/tspl.test.ts`, `zpl.test.ts`, `cpcl.test.ts`.
- [x] T022 [P] [US2] Port the data-source assertions (DATA-1..3) to `app/tests/unit/shared/domain/datasource.test.ts`, including serial repeat/basis, date/time offsets and fixed-clock determinism.
- [x] T023 [P] [US2] Port the script runtime assertions (DATA-4..6) to `app/tests/unit/shared/domain/scriptRuntime.test.ts`: VB/JS semantics, sandbox rejection, quotas, shared variables and typed state.
- [ ] T024 [P] [US2] Port document model/migration assertions (DOC-1..2) to `app/tests/unit/shared/domain/document.test.ts`, including future-version rejection, password redaction and normalization idempotence.
- [ ] T025 [P] [US2] Port editor operation assertions (EDIT-1..4) to `app/tests/unit/renderer/operations.test.ts`: align reference object, grouping math, resize constraints, availability matrix and table helpers.
- [ ] T026 [P] [US2] Port geometry/history assertions (EDIT-5, DOC-5) to `app/tests/unit/renderer/editor-geometry.test.ts` and `app/tests/unit/renderer/document-history.test.ts`.
- [ ] T027 [P] [US2] Port barcode assertions (BARC-1) to `app/tests/unit/shared/domain/barcode-charset.test.ts` and `barcode-spec.test.ts`.
- [ ] T028 [P] [US2] Port colour-change assertions (COLOR-1) to `app/tests/unit/shared/domain/color-change.test.ts`, including deterministic random colours and native-printer capability.
- [ ] T029 [P] [US2] Port catalog/format/title/close-guard/label-spec assertions to `app/tests/unit/shared/domain/printer-catalog.test.ts`, `label-formats.test.ts`, `app/tests/unit/shared/appTitle.test.ts`, `close-guard.test.ts`, `label-spec.test.ts`.
- [ ] T030 [P] [US2] Port document save queue and close-safety assertions (DOC-3) to `app/tests/unit/renderer/documentPersistence.test.ts`.
- [ ] T031 [P] [US2] Port delimited-import assertions (DATA-8) to `app/tests/unit/renderer/dataImport.test.ts` (comma/tab/semicolon, quotes, BOM, GB18030 fallback).
- [ ] T032 [US2] Run the mutation check on one print-plan, one script-runtime and one document-history assertion; confirm each new test fails when the behavior is broken, then revert. Record results in `LEGACY-ASSERTIONS.md`.
- [ ] T033 [US2] Update `LEGACY-ASSERTIONS.md` statuses for US2 to `ported`/`verified`; call out any assertion with no new equivalent.

**Checkpoint**: All core domain behavior has a new Vitest equivalent and the oracle still
passes.

## Phase 5: User Story 3 - 集成与契约测试重建 (Priority: P2)

**Goal**: Rebuild contract and main-process integration tests with controlled substitutes.

**Independent Test**: Contracts and integration suites pass in an offline, printer-free
environment; no test touches the real profile or external services.

- [ ] T034 [P] [US3] Port IPC contract assertions (IPC-1) to `app/tests/contracts/ipc-contract.test.ts`: channel names, payload shapes, port/db validation and sender/path guards.
- [ ] T035 [P] [US3] Port template-format assertions to `app/tests/contracts/template-format.test.ts`: `.msdx` envelope, legacy JSON, migration, redaction and duplicate-path rules.
- [ ] T036 [P] [US3] Port `.lsdx` import assertions to `app/tests/contracts/lsdx-import.test.ts` under jsdom using `app/fixtures/lsdx/minimal.lsdx`.
- [ ] T037 [P] [US3] Port protocol golden assertions to `app/tests/contracts/protocol-golden.test.ts`: byte length, SHA-256 and `mustContain` tokens; keep `.gitattributes -text`.
- [ ] T038 [P] [US3] Port license integration assertions to `app/tests/integration/main/license.test.ts`: activate/check/cache, machine binding, unreachable server, offline editing.
- [ ] T039 [P] [US3] Port cloud repository assertions to `app/tests/integration/main/cloud.test.ts`: remote/offline selection, credentials, template CRUD payloads; mock `net` and `safeStorage`.
- [ ] T040 [P] [US3] Port template IPC/path-access assertions to `app/tests/integration/main/template-ipc.test.ts`: path selection writes nothing, `saveTo` writes once, unauthorized paths rejected.
- [ ] T041 [P] [US3] Port database bridge assertions to `app/tests/integration/main/db.test.ts`: mocked `child_process` for all platforms plus a Windows-only real-PowerShell UTF-8/BOM case.
- [ ] T042 [P] [US3] Port command-transport assertions to `app/tests/integration/main/printing-transport.test.ts`: TCP/COM/USB/file paths, cancellation and partial/unknown results.
- [ ] T043 [P] [US3] Port print-executor assertions to `app/tests/integration/renderer/print-executor.test.ts`, mocking `renderLabel` and `bitmapSource`; cover batch splitting, test print and serial advancement.
- [ ] T044 [P] [US3] Port data-management hook assertions to `app/tests/integration/renderer/data-management.test.ts`: refresh cancellation, latest-request-wins, dataset rename rebinding.
- [ ] T045 [US3] Update `LEGACY-ASSERTIONS.md` statuses for contracts/integration and verify every test uses temp dirs/mocks and leaves no external side effects.

**Checkpoint**: Contracts and integration boundaries are covered without Electron or
external services.

## Phase 6: User Story 4 - Electron 关键旅程 E2E (Priority: P2)

**Goal**: Replace one-off UI scripts with four stable Playwright journeys.

**Independent Test**: `npm run test:e2e` builds the app and passes the four journeys on
Windows with isolated userData and failure artifacts.

- [ ] T046 [P] [US4] Create `app/tests/e2e/fixtures/electron-app.ts`: built-app launch, `ELECTRON_RUN_AS_NODE` removal, temp `--user-data-dir`, first-run handling, bounded teardown (`app.exit(0)` + force-kill), screenshot/trace helpers.
- [ ] T047 [P] [US4] Add `app/tests/e2e/app-launch.spec.ts`: launch, dismiss GetStarted, assert `start-page` and editor shell.
- [ ] T048 [P] [US4] Add `app/tests/e2e/template-roundtrip.spec.ts`: open a `.msdx` via `MAXLABEL_OPEN_PATH`, edit, save, reparse and compare the normalized document.
- [ ] T049 [P] [US4] Add `app/tests/e2e/print-preview.spec.ts`: open fixture, click `打印预览`, wait for the second window, assert page count and non-zero image, close; never submit a real print.
- [ ] T050 [P] [US4] Add `app/tests/e2e/offline-license.spec.ts`: fresh profile, no server URL, launch/edit/save; assert no external network dependency.
- [ ] T051 [US4] Port the reproducible parts of `workspace-regression.tsx` (ruler/zoom/fit/ context menu) and `render-regression.ts` (page bitmap parity) into E2E or record an approved retirement in `LEGACY-ASSERTIONS.md`.
- [ ] T052 [US4] Run the E2E suite 20 times on Windows (or the agreed stability sample), record flaky vs deterministic failures, and verify artifacts on failure; write results to `app/tests/e2e/STABILITY.md`.

**Checkpoint**: Four journeys pass consistently; rendering/geometry coverage is either
ported or explicitly retired.

## Phase 7: User Story 5 - CI 分层与质量可见性 (Priority: P3)

**Goal**: Make the test architecture visible and enforced in CI.

**Independent Test**: A PR runs the fast gate; E2E runs separately; coverage and failure
artifacts are available.

- [ ] T053 [P] [US5] Finalize the `fast` CI job in `.github/workflows/ci.yml`: install, audit, `typecheck`, `typecheck:test`, `test:coverage`, build; upload coverage; enforce the 2-minute runtime budget.
- [ ] T054 [P] [US5] Finalize the `e2e` job in `.github/workflows/ci.yml`: build, `playwright test`, cache Electron, upload `app/playwright-report/`/`app/test-results/`, separate retry reporting.
- [ ] T055 [P] [US5] Add the non-blocking `legacy` job and the manual `release` job to `.github/workflows/ci.yml`; keep installer tests out of the fast gate.
- [ ] T056 [P] [US5] Create `app/tests/README.md`: layers, how to add a test, run a single test, update goldens, debug E2E, environment caveats (`ELECTRON_RUN_AS_NODE`, Electron cache).
- [ ] T057 [P] [US5] Create `app/tests/INDEX.md` mapping product behaviors to test files and layer/gate membership.
- [ ] T058 [US5] Verify coverage thresholds and report output in CI; confirm generated files are excluded and the 80% line threshold is meaningful; adjust `app/vitest.config.ts` and `.github/workflows/ci.yml` if needed, and confirm the threshold with the owner.

**Checkpoint**: CI exposes fast, E2E and legacy results; coverage and E2E artifacts are
available.

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Retire the legacy suite and leave a maintainable, documented architecture.

- [ ] T059 Run the full validation: `npm run typecheck`, `npm run typecheck:test`, `npm test`, `npm run test:coverage`, `npm run test:e2e`, `npm run test:legacy`.
- [ ] T060 Complete `LEGACY-ASSERTIONS.md`: every P1 assertion is `ported`/`verified`, or `retire` with an owner approval note.
- [ ] T061 Remove the legacy test suite in one reversible commit: old `.test.ts`, regression `.cjs`, Electron harnesses and their scripts; keep build/generator/release tooling and installer tests. Update `app/package.json` to remove `test:legacy` and the old `test:*` entries.
- [ ] T062 Update `CLAUDE.md`, `app/tests/README.md` and CI docs to describe the final gate, commands and ownership.
- [ ] T063 Final constitution check: no product behavior changed, every P1 behavior has a new test or approval, no test depends on `parity/`/`app/docs`, and the fast suite is under 2 minutes.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → no dependencies.
- **Foundational (Phase 2)** → depends on Setup; T010 and T011 block all story phases.
- **US1 (Phase 3)** → depends on Setup + Foundational.
- **US2 (Phase 4)** → depends on Foundational; can start after US1's runner smoke test.
- **US3 (Phase 5)** → depends on Foundational; independent of US2, but shares factories.
- **US4 (Phase 6)** → depends on the P0 spike (T011) and builds on US1/US2 for fixtures.
- **US5 (Phase 7)** → can start once US1 and US4 have runnable commands.
- **Polish (Phase 8)** → depends on all desired story phases.

### User Story Dependencies

- **US1 (P1)**: runner/gate; no dependency on other stories.
- **US2 (P1)**: domain tests; no dependency on US1 except the runner.
- **US3 (P2)**: contracts/integration; can run in parallel with US2.
- **US4 (P2)**: E2E; depends on the P0 spike and built app.
- **US5 (P3)**: CI/visibility; depends on runnable commands from US1/US4.

### Parallel Opportunities

- T002–T005, T007–T008 (configs/helpers) can run in parallel.
- T011–T013 (spike/coverage/CI) can run in parallel once Setup is done.
- T020–T031 (US2 test files) are mostly independent and can be split across developers.
- T034–T044 (US3 contracts/integration) are independent by boundary.
- T047–T050 (four E2E journeys) can be written in parallel after T046.

## Parallel Example: US2

```text
T020  print scene/plan tests
T021  TSPL/ZPL/CPCL tests
T022  data source tests
T023  script runtime tests
T024  document model tests
T025  editor operations tests
```

## Implementation Strategy

### MVP First

1. Complete Setup + Foundational (T001–T014).
2. Complete US1 (T015–T019): a fast, reliable gate.
3. **STOP and VALIDATE**: run `npm test` on a clean checkout.

### Incremental Delivery

1. US1 → fast gate.
2. US2 → core domain coverage.
3. US3 → contracts/integration.
4. US4 → E2E journeys.
5. US5 → CI/visibility.
6. Polish → legacy removal and final documentation.

### During the Full Rewrite

- Do not add new tests to `app/scripts`.
- Keep `test:legacy` green until T060.
- Record every lost assertion; do not silently retire.
- Do not change product behavior; separate fixes from test migration.

## Notes

- `[P]` tasks touch different files and can run in parallel.
- Every test task must use explicit imports from `vitest` (`describe`, `it`, `expect`, `vi`).
- Integration tests use real OS temp dirs; E2E tests use a unique `--user-data-dir`.
- Protocol goldens are read as `Buffer`; never normalize line endings.
- Electron E2E must not click the preview's print button or contact a real printer.

## Progress Log

- **2026-10-18 — T001–T019 complete.**
  - `npm test` (typecheck + typecheck:test + unit) passes in ~6.5 s; 16 unit assertions.
  - P0 Playwright Electron spike passed: Electron 44.3.0, Playwright 1.64.1, isolated
    userData, `app.exit(0)` teardown (see `research.md`).
  - Mutation check on `mm2dot` (round→floor) was caught by the unit tests, then reverted.
  - `test:coverage` is configured but exits 1 at 0% until the US2 domain tests land — expected.
  - CI skeleton added (`fast`, `e2e`, `legacy`, `release`); `npm audit` still reports
    12 advisories in the existing electron-builder chain (see `research.md`).
- **2026-10-18 — T020–T023 complete.** Print scene/plan, TSPL/ZPL/CPCL, data sources and
  script runtime ported; `npm test` runs 114 tests in ~7 s. Coverage is 57.5% lines
  (54.65% statements), below the 80% target until the remaining domain/integration tests land.

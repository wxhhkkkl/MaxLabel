---
description: "Task list for cross-platform builds and transports"
---

# Tasks: Cross-Platform Builds and Transports

**Input**: Design documents from `specs/005-cross-platform/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Required (TDD). Adapter contract tests are written before extraction or new
platform code. Windows behavior is the regression oracle.

**Organization**: Tasks are grouped by user story. The 003 transport contract and the 004
ESC/POS builder are the compatibility boundary.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files/commands)
- **[Story]**: `[US1]` … `[US6]` for user-story phases only
- Every task names an exact file path or command

## Phase 1: Setup (Adapter Tests and Doubles)

**Purpose**: Establish the red adapter/build tests and doubles.

- [x] T001 Write failing adapter selection/contract tests in `app/tests/unit/main/transport-adapter.test.ts`.
- [x] T002 Add test doubles for `execFile`, `serialport` and `usb` in `app/tests/helpers/platformDoubles.ts`.
- [x] T003 Add a build-target assertion test in `app/tests/unit/main/build-targets.test.ts` (mac dmg/zip, linux AppImage/deb, native deps).

## Phase 2: Foundational (Adapter Boundary)

**Purpose**: Introduce the adapter boundary and preserve Windows behavior.

- [x] T004 Create `app/src/main/printing/transports/types.ts` and `index.ts` with platform selection; make T001 pass.
- [x] T005 Extract the existing implementation into `app/src/main/printing/transports/windows.ts` and delegate from `app/src/main/printing/commandTransport.ts`; run `app/tests/integration/main/printing-transport.test.ts`.
- [x] T006 Add `serialport`/`usb` dependencies, Electron rebuild and `asarUnpack` rules to `app/package.json`.
- [x] T007 Add macOS/Linux build jobs and artifact upload skeleton to `.github/workflows/ci.yml`.

**Checkpoint**: Windows transport tests stay green; adapter selection compiles.

## Phase 3: User Story 1 - macOS Build/Run (Priority: P1)

**Goal**: macOS x64/arm64 build and transport.

**Independent Test**: macOS build smoke + adapter tests.

- [x] T008 Add macOS `dmg`/`zip` x64/arm64 targets to `app/package.json`/electron-builder config; build and record the result in `specs/005-cross-platform/verification/hardware-matrix.md`. CI run 39185795944 built both arches (unsigned).
- [x] T009 [P] [US1] Add macOS adapter selection/CUPS/serial integration tests in `app/tests/integration/main/unix-transport.test.ts`.
- [ ] T010 [US1] Run the manual macOS checks in `specs/005-cross-platform/quickstart.md` and record them in `verification/hardware-matrix.md`.

**Checkpoint**: macOS artifact builds and core transports are verified.

## Phase 4: User Story 2 - Linux Build/Run (Priority: P1)

**Goal**: Linux x64 build and transport.

**Independent Test**: Ubuntu build smoke + adapter tests.

- [x] T011 Add Linux `AppImage`/`deb` x64 targets to `app/package.json`/electron-builder config; build and record in `specs/005-cross-platform/verification/hardware-matrix.md`. CI run 39185795944 built both targets (unsigned).
- [x] T012 [P] [US2] Add Linux adapter/CUPS/serial/USB tests in `app/tests/integration/main/unix-transport.test.ts`.
- [ ] T013 [US2] Run the manual Ubuntu checks and udev/permission scenarios; record in `specs/005-cross-platform/verification/hardware-matrix.md`.

**Checkpoint**: Linux artifact builds and core transports are verified.

## Phase 5: User Story 3 - Cross-Platform Transports (Priority: P1)

**Goal**: Driver/CUPS, serial, USB, LPT and unchanged TCP/file.

**Independent Test**: `unix-transport.test.ts` + Windows regression.

- [x] T014 [P] [US3] Implement CUPS `lpstat` enumeration and `lp` raw/driver submission in `app/src/main/printing/transports/unix.ts`; add tests with fake `execFile`.
- [x] T015 [P] [US3] Implement `serialport` COM/Bluetooth adapter with framing options in `app/src/main/printing/transports/serial.ts`; add tests.
- [x] T016 [P] [US3] Implement `usb`/libusb raw output and accessible-device listing in `app/src/main/printing/transports/usb.ts`; add permission/error tests.
- [x] T017 [US3] Return a clear unsupported error for LPT on macOS/Linux and verify TCP/file are unchanged in `app/src/main/printing/transports/index.ts`; add tests.
- [x] T018 [US3] Verify status/cancel/batching semantics against `specs/003-printing-pipeline/contracts/transport.md`; add tests in `app/tests/integration/main/unix-transport.test.ts`.

**Checkpoint**: All port types have a defined unix behavior and tests.

## Phase 6: User Story 4 - Device Enumeration/UI (Priority: P2)

**Goal**: CUPS/serial/USB enumeration and platform-aware UI.

**Independent Test**: enumeration tests + UI smoke.

- [x] T019 [P] [US4] Implement CUPS/serial/USB enumeration and merged `PrinterFacts` in `app/src/main/printing/transports/index.ts`; add tests in `app/tests/unit/main/transport-adapter.test.ts`.
- [x] T020 [US4] Update `app/src/renderer/src/dialogs/PrinterSettings.tsx` for platform-aware ports/errors; add a UI/unit test.

**Checkpoint**: Users can discover unix devices and get actionable errors.

## Phase 7: User Story 5 - Build/CI (Priority: P2)

**Goal**: Native modules, artifacts and CI matrix.

**Independent Test**: packaged app smoke + CI artifacts.

- [ ] T021 [US5] Verify native modules load from the packaged app (rebuild/asarUnpack) on macOS/Linux; record results in `specs/005-cross-platform/verification/hardware-matrix.md`.
- [x] T022 [US5] Finalize macOS/Linux CI jobs in `.github/workflows/ci.yml`: builds, artifact upload, signing-status reporting. Jobs write the status to the step summary and `release/SIGNING-STATUS.txt`; macOS signing is opt-in via `CSC_LINK`/`CSC_KEY_PASSWORD`.
- [x] T023 [US5] Document signing/notarization and unsigned-artifact labeling in `specs/005-cross-platform/quickstart.md` and release notes.

**Checkpoint**: Three-platform artifacts and signing status are visible in CI.

## Phase 8: User Story 6 - ESC/POS Cross-Platform (Priority: P3)

**Goal**: 004 output identical across platforms.

**Independent Test**: ESC/POS golden/executor tests on unix adapters.

- [x] T024 [US6] Verify ESC/POS output is platform-independent and only transport differs; add adapter tests in `app/tests/integration/renderer/print-executor-escpos.test.ts`/`unix-transport.test.ts`.

**Checkpoint**: ESC/POS works through unix transports without command changes.

## Phase 9: Polish & Cross-Cutting

- [x] T025 Run the Windows full gate: `npm test`, `npm run test:coverage`, `npm run test:e2e`; record results.
- [x] T026 Complete `specs/005-cross-platform/verification/hardware-matrix.md` and update `app/tests/INDEX.md`/`README.md`. Matrix records CI evidence and the remaining hardware-only gaps; test docs list the adapter/build tests.
- [x] T027 Commit the cross-platform feature with `git add specs/005-cross-platform app .github && git commit`.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → no dependencies.
- **Foundational (Phase 2)** → depends on Setup; blocks all stories.
- **US1/US2 (Phase 3/4)** → depend on Foundational.
- **US3 (Phase 5)** → depends on Foundational; CUPS/serial/USB adapters.
- **US4 (Phase 6)** → depends on US3 adapters.
- **US5 (Phase 7)** → depends on build config and native deps.
- **US6 (Phase 8)** → depends on US3 adapters and 004.
- **Polish (Phase 9)** → depends on desired stories.

### User Story Dependencies

- **US1 (P1)**: macOS build; can run after foundational.
- **US2 (P1)**: Linux build; parallel with US1.
- **US3 (P1)**: transports; parallel with US1/US2.
- **US4 (P2)**: enumeration/UI after US3.
- **US5 (P2)**: packaging/CI after build config.
- **US6 (P3)**: after US3 and 004.

### Parallel Opportunities

- T001–T003 test scaffolding.
- T009/T012 unix adapter tests.
- T014/T015/T016 CUPS/serial/USB adapters.
- T021/T022/T023 native/build/CI.
- macOS and Linux manual matrices can run independently.

## Parallel Example: US3

```text
T014  CUPS/lp adapter
T015  serialport adapter
T016  USB adapter
```

## Implementation Strategy

### MVP First

1. Setup + Foundational (T001–T007).
2. US3 transports (T014–T018).
3. **STOP and VALIDATE**: Windows regression + unix adapter tests.

### Incremental Delivery

1. US3 → transport adapters.
2. US1/US2 → builds and manual checks.
3. US4 → enumeration/UI.
4. US5 → CI/artifacts.
5. US6 → ESC/POS cross-platform.

### Safety Rules

- Do not change Windows transport behavior; the 003/004 tests are the oracle.
- Use `execFile` argument arrays; never shell-interpolate queue/device/path input.
- Native module load failures must fail builds/tests clearly.
- Hardware-only behavior is recorded in the matrix, not guessed.
- Signing/notarization is explicit, never silent.

## Notes

- This feature adds platform adapters and packaging; protocol generation is unchanged.
- LPT is Windows-only; macOS/Linux return a clear error.
- Unsigned artifacts are allowed but labeled.
- **2026-10-19 — T001–T007 complete.** Adapter contract/selection tests, Windows
  extraction behind `transports/`, unix TCP stub, native serial/USB dependencies and
  mac/linux build config added. Windows gate: 355 tests / 44 files, 7 E2E — green.
  Remaining: unix CUPS/serial/USB adapters, macOS/Linux builds/manual checks, CI jobs
  (configured but not run).
- **2026-10-19 — unix adapters and enumeration implemented.** CUPS/lp, serialport and
  usb/libusb adapters with injected-double tests; platform-aware port UI; Windows gate
  362 tests / 85.82% lines / 7 E2E. Remaining open: macOS/Linux builds and real-device
  checks (T008/T010/T011/T013), packaged native-module smoke (T021), CI run (T022),
  hardware matrix (T026), commit (T027).
- **2026-10-19 — CI builds and reporting settled.** Run 39185795944 passed on Windows
  (362 tests, 7 E2E), macOS (dmg/zip x64+arm64) and Linux (AppImage/deb). CI now reports
  signing status in the job summary and `release/SIGNING-STATUS.txt`. Run 39188109347
  passed all jobs, including the signing step; `420528a` fixed an empty-`CSC_LINK`
  failure found by the first run. Remaining open items need real hardware or a packaged
  runtime: T010, T013, T021.

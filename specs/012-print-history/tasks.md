---
description: "Task list for print history and log management (as-is verification)"
---

# Tasks: Print History and Log Management (As-Is)

**Input**: Design documents from `specs/012-print-history/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`,
`quickstart.md`

**Tests**: Required (project constitution). New tests are written and seen failing before
any production-code change. This is an as-is feature; production changes are limited to
behaviour-preserving extraction and fixes a test proves necessary.

**Organization**: Tasks follow the three user stories. US1 (view history) is the MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: `[US1]` … `[US3]` for user-story phases only
- Every task names an exact file path or command

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 [P] Create log test fixtures and an IPC harness (sample `PrintLog` payload builder, temp userData/electron mock setup, handler map) in `app/tests/helpers/logs.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T002 Run `cd app && env -u ELECTRON_RUN_AS_NODE npm test` to confirm the baseline gate is green and record it in `specs/012-print-history/quickstart.md` (Validation record).

**Checkpoint**: Fixtures and baseline ready.

---

## Phase 3: User Story 1 - View print history (Priority: P1) 🎯 MVP

**Goal**: The history dialog lists the newest rows with the documented columns and detail
panel, reads safely with corrupt lines, and validates incoming payloads.

**Independent Test**: Write one `log:print` row and open the history; the list shows the
localized row and the detail panel shows the snapshot.

### Tests for User Story 1

- [X] T003 [P] [US1] Write failing payload-validation tests (time ≤128 required, title/printer ≤255, mode enum, count 0–100000, copies 0–99999, physical/sent 0–9999900000, status enum, test boolean, snapshot ≤100000×1 MiB/16 MiB) in `app/tests/unit/main/log-validation.test.ts`.
- [X] T004 [P] [US1] Write failing integration tests for append/list (newest rows, missing file, invalid lines skipped, JSONL `app: 'maxlabel'`) in `app/tests/integration/main/log-ipc.test.ts`.
- [X] T005 [P] [US1] Write failing renderer tests for the history columns, status mapping, physical-count fallback, sent `—`, test/normal label and detail snapshot formatting in `app/tests/unit/renderer/print-history.test.ts`.

### Implementation for User Story 1

- [X] T006 [US1] Verify `validatePrintLogPayload` in `app/src/main/ipc/validation.ts` against T003; no behavior change unless a test proves a gap.
- [X] T007 [US1] Make `app/src/main/ipc/registerLogIpc.ts` testable (extract `printLogPath`/`parseLogs`/append helpers into `app/src/main/ipc/logStore.ts` if needed) and make T004 pass without behavior change.
- [X] T008 [US1] Verify `app/src/renderer/src/dialogs/PrintHistoryDialog.tsx` against T005; adjust only the presentation if a test proves a mismatch.
- [X] T009 [US1] Add E2E coverage in `app/tests/e2e/print-history.spec.ts`: write a row via `window.maxlabel.logPrint`, open 查看 → 打印历史记录, assert the row/columns/detail/snapshot, and assert the empty state on a fresh profile.

**Checkpoint**: History list and detail work with real IPC.

---

## Phase 4: User Story 2 - Export, open, clear and delete logs (Priority: P2)

**Goal**: Users can export CSV, open the raw JSONL, clear all rows and delete one timestamp,
with the documented confirmations and messages.

**Independent Test**: Export two rows and confirm the headers/encoding; delete one row and
confirm the others remain; clear and confirm the file is empty.

### Tests for User Story 2

- [X] T010 [P] [US2] Write failing CSV export tests (fixed headers, quoting of `,` `"` and newlines, UTF-8 BOM, CRLF, empty history, canceled dialog) in `app/tests/integration/main/log-export.test.ts`.
- [X] T011 [P] [US2] Write failing maintenance tests (open creates an empty file; clear truncates; delete filters by `time`; operations queue behind writes) in `app/tests/integration/main/log-maintenance.test.ts`.

### Implementation for User Story 2

- [X] T012 [US2] Verify `log:export` in `app/src/main/ipc/registerLogIpc.ts` against T010; extract the CSV formatter into `app/src/main/ipc/logStore.ts` if needed, without changing column order or encoding.
- [X] T013 [US2] Verify `log:open`, `log:clear` and `log:delete` against T011; no behavior change unless a test proves a gap.
- [X] T014 [US2] Extend `app/tests/e2e/print-history.spec.ts` to confirm/delete one row and clear the list, asserting the remaining rows and messages.
- [X] T015 [US2] Verify the UI messages/localization for export/open/clear/delete failures in `app/src/renderer/src/dialogs/PrintHistoryDialog.tsx`; no behavior change unless a test proves a gap.

**Checkpoint**: All history actions work from the dialog.

---

## Phase 5: User Story 3 - Reliable writes and bounded storage (Priority: P3)

**Goal**: Writes are serialized, corrupt lines are tolerated, the file is capped at 64 MB
and test prints/executor failures follow the documented rules.

**Independent Test**: Append a corrupt line and read the history; exceed the cap and confirm
compaction; run two writes concurrently and confirm no interleaving.

### Tests for User Story 3

- [X] T016 [P] [US3] Write failing capacity/lifecycle tests (64 MB compaction keeps ≤9 999 parseable rows, atomic rewrite, serialized concurrent writes, read waits for queued writes, truncated tail skipped) in `app/tests/integration/main/log-capacity.test.ts`.
- [X] T017 [P] [US3] Write failing executor logging tests (one row per non-test attempt, no row for test prints, log failure swallowed) in `app/tests/integration/renderer/log-executor.test.ts`.

### Implementation for User Story 3

- [X] T018 [US3] Refactor the append/compaction/queue logic in `app/src/main/ipc/registerLogIpc.ts` into `app/src/main/ipc/logStore.ts` with unchanged behavior and make T016 pass.
- [X] T019 [US3] Verify `app/src/renderer/src/features/printing/printExecutor.ts` logging calls against T017; fix only if a test proves a gap.

**Checkpoint**: Capacity and executor logging are verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T020 [P] Update `app/tests/INDEX.md` and `app/tests/README.md` with the log/history test files.
- [X] T021 Run the full gate: `cd app && env -u ELECTRON_RUN_AS_NODE npm test`, `npm run test:coverage`, and `env -u ELECTRON_RUN_AS_NODE npm run test:e2e`; record results in `specs/012-print-history/quickstart.md`.
- [X] T022 Run manual validation V-01–V-06 from `specs/012-print-history/quickstart.md` and record the outcomes there.
- [X] T023 Update `specs/012-print-history/spec.md`/`data-model.md` only for confirmed as-is corrections found during verification; leave the three `TODO(待确认)` items unresolved unless the owner decides.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → no dependencies.
- **Foundational (Phase 2)** → depends on Setup; blocks all stories.
- **US1 (Phase 3)** → depends on Foundational; MVP.
- **US2 (Phase 4)** → depends on US1's read path.
- **US3 (Phase 5)** → depends on Foundational; independent of US2.
- **Polish (Phase 6)** → depends on the desired stories.

### Within Each Story

- Tests first, seen failing, then the smallest behavior-preserving change.
- One file owns path/parse/append/CSV helpers after extraction.
- A test that exposes a mismatch is a stop-and-clarify point unless it is a documented TODO.

### Parallel Opportunities

- T003/T004/T005 (different test files).
- T010/T011 (different integration files).
- T016/T017 (different test files).
- T020 documentation while the gate runs.

---

## Parallel Example: User Story 1

```text
T003  validation tests        tests/unit/main/log-validation.test.ts
T004  log IPC tests           tests/integration/main/log-ipc.test.ts
T005  history view tests      tests/unit/renderer/print-history.test.ts
```

---

## Implementation Strategy

### MVP First

1. Setup + Foundational (T001–T002).
2. US1 (T003–T009).
3. **STOP and VALIDATE**: write a row and inspect the history dialog.

### Incremental Delivery

1. US1 → list/detail.
2. US2 → export/open/clear/delete.
3. US3 → capacity, queue and executor logging.
4. Polish → full gate and recorded validation.

### Safety Rules

- Keep `log:print` as the only writer and `shared/print/logSchema.ts` as the only header
  source.
- Do not change the JSONL path/format or add a database.
- Do not log test prints or let a log failure fail a print.
- Do not resolve the delete-by-time collision without an owner decision.

## Notes

- Existing integration tests mock `electron` with `helpers/electronMock`; reuse it for the
  new main-process tests.
- Real printers are not required: rows can be written through `log:print`.

---

## Phase 7: Convergence

- [X] T024 Make `log:export` treat an existing-but-empty log file as “no records” (`history.empty`, no save dialog/file) in `app/src/main/ipc/registerLogIpc.ts`, with a failing test that clears the log and then exports in `app/tests/integration/main/log-export.test.ts`, per FR-006 / US2/AC2 (`partial`).

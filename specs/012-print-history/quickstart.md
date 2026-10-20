# Quickstart: Print History and Log Management (As-Is)

**Feature**: `012-print-history` | **Date**: 2026-10-20

## Prerequisites

- Windows 10/11 x64 primary; Node.js ≥ 22.12.0; `npm install` completed.
- `app/` builds and the existing test gate passes.
- No printer is required: rows can be written through `log:print` from the renderer console
  or by a command-file print job.

## Automated validation

```bash
cd app
npm test
npm run test:coverage
env -u ELECTRON_RUN_AS_NODE npm run test:e2e
```

### Existing evidence

- `tests/integration/renderer/print-executor.test.ts` — the executor logs after driver/
  command attempts and ignores log failures.
- `tests/unit/shared/i18n/*` — history labels and numeric formatting keys.
- No dedicated test currently exercises the JSONL lifecycle, CSV export or the history
  dialog; this plan adds them.

### Planned coverage (tests first, then code only if a test exposes a defect)

| Behavior | Test file | Layer |
|----------|-----------|-------|
| Payload validation ranges and snapshot limits | `tests/unit/main/log-validation.test.ts` | unit |
| JSONL append/list/delete/clear/open with a temp userData | `tests/integration/main/log-ipc.test.ts` | integration |
| 64 MB compaction, corrupt lines and row limits | `tests/integration/main/log-capacity.test.ts` | integration |
| CSV header/quoting/BOM and cancel/empty paths | `tests/integration/main/log-export.test.ts` | integration |
| History columns, status mapping and detail | `tests/unit/renderer/print-history.test.ts` | unit |
| History dialog smoke (write row → list → detail → delete/clear) | `tests/e2e/print-history.spec.ts` | e2e |

If a planned test exposes a mismatch, decide which side encodes the intended as-is behaviour
before changing code.

## Manual validation

### V-01 List and detail

1. Write one row via `window.maxlabel.logPrint({ time: new Date().toISOString(), title: '测试模板', mode: 'driver', count: 3, copies: 2, physicalCount: 6, sentCount: 6, status: 'submitted', test: false, printer: 'Test Printer', dataSnapshot: ['A | B'] })`.
2. Open 查看 → 打印历史记录.

Expected: one row with localized time/numbers, planned 6, sent 6, status 已提交; clicking it
shows the snapshot line `#1 A | B`.

### V-02 Empty state

1. Clear the log (or use a fresh profile) and open the history.

Expected: empty-state message and count 0.

### V-03 CSV export

1. With at least two rows, click 导出 CSV and save.

Expected: the dialog defaults to `打印历史-YYYY-MM-DD.csv`; the file opens in Excel with the
ten fixed headers, UTF-8 Chinese text and CRLF rows; canceling creates no file.

### V-04 Open raw log

1. Click 打开日志文件.
2. Delete the file and click again.

Expected: the OS opens `print-log.jsonl`; when missing, an empty file is created first.

### V-05 Delete and clear

1. Click 删除 on one row and confirm.
2. Click 清空 and confirm; cancel once first.

Expected: only the chosen timestamp rows are removed; cancel leaves the file unchanged;
clear results in an empty file and empty list.

### V-06 Capacity and corruption

1. Append an invalid JSON line to `print-log.jsonl`.
2. Reopen the history.
3. (Optional) Let the file exceed 64 MB with a script and write one more row.

Expected: the invalid line is skipped and other rows remain; after exceeding 64 MB the file
is compacted to the newest ≤9 999 parseable rows plus the new row.

## Validation record (2026-10-20)

| Gate | Command | Result |
|------|---------|--------|
| Baseline before changes | `env -u ELECTRON_RUN_AS_NODE npm test` | 595 tests / 31 E2E PASS |
| Typecheck (node/web/test) + Vitest | `env -u ELECTRON_RUN_AS_NODE npm test` | 100 files / 624 tests PASS |
| Coverage (`shared/domain` + `shared/print`, 80% lines) | `npm run test:coverage` | PASS — 87.53% lines |
| Playwright Electron E2E | `env -u ELECTRON_RUN_AS_NODE npx playwright test` | 33 passed |

Scenario evidence:

| Scenario | Evidence | Result |
|----------|----------|--------|
| V-01 list and detail | `integration/main/log-ipc.test.ts`, `e2e/print-history.spec.ts` | PASS |
| V-02 empty state | `e2e/print-history.spec.ts` | PASS |
| V-03 CSV export | `integration/main/log-export.test.ts` (headers, quoting, BOM, CRLF, cancel, empty and cleared logs) | PASS (native save dialog not driven in E2E) |
| V-04 open raw log | `integration/main/log-maintenance.test.ts` | PASS |
| V-05 delete and clear | `integration/main/log-maintenance.test.ts`, `e2e/print-history.spec.ts` | PASS |
| V-06 capacity and corruption | `integration/main/log-capacity.test.ts` | PASS (small configured cap; the 64 MB cap is the default) |

Implementation notes:

- File operations were extracted into `app/src/main/ipc/logStore.ts` without changing the
  JSONL format, limits or messages.
- The executor now swallows a rejected `logPrint` dependency so a log failure cannot turn a
  successful print into a failed job (verified by `integration/renderer/log-executor.test.ts`).
- History presentation helpers (status key, physical-count fallback, newest-first sort) moved
  to `features/printing/printHistory.ts`.
- T024: an existing-but-empty log (for example after “清空”) is treated as no records by
  `log:export`, so no save dialog or header-only CSV is produced.

Not exercised: the native save dialog in E2E, real printers, and a real 64 MB file.

## Known boundaries (do not change without owner confirmation)

- Delete matches by `time`; duplicate timestamps are removed together (`TODO(待确认)`).
- CSV exports all parseable rows while the list shows the newest 10 000 (`TODO(待确认)`).
- A truncated tail line is skipped; proactive repair is `TODO(待确认)`.
- Test prints are not logged (003 FR-012); the `test` field remains for historical rows.

## Out of scope

- Editing/reprinting from history, filtering, or scheduled log maintenance.
- Changing the JSONL location/format or moving logs into a database.
- Cloud sync or encryption.

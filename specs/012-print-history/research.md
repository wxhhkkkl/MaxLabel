# Research: Print History and Log Management (As-Is)

**Feature**: `012-print-history` | **Date**: 2026-10-20

## Method

Brownfield analysis of `main/ipc/registerLogIpc.ts`, `main/ipc/validation.ts`,
`shared/print/logSchema.ts`, `shared/ipcContract.ts`, `PrintHistoryDialog` and the
print-executor logging calls. No new persistence model was designed. Open questions remain
`TODO(待确认)` and are outside the change scope.

## D-001: JSONL in the user-data directory

- **Decision**: Keep one append-oriented JSONL file at `userData/print-log.jsonl`, one JSON
  object per line with `app: 'maxlabel'`.
- **Rationale**: Append-only JSONL survives partial writes better than a single JSON array,
  is human-readable for support, and needs no database dependency.
- **Alternatives considered**: SQLite (rejected: new dependency/migration for a small log);
  a JSON array rewritten on every entry (rejected: O(n) writes and corruption risk).

## D-002: Main-process validation

- **Decision**: `log:print` validates the payload before writing:
  - `time` required, ≤128 chars; `title` ≤255; `mode` must be `driver` or `command`;
  - `count` integer 0–100 000; `copies` integer 0–99 999;
  - `physicalCount` / `sentCount` integer 0–9 999 900 000;
  - `status` one of completed/submitted/partial/failed/canceled/unknown;
  - `test` boolean; `printer` ≤255;
  - `dataSnapshot` ≤100 000 lines, each ≤1 MiB, total ≤16 MiB.
  Invalid payloads return `error.log` and write nothing.
- **Rationale**: The renderer is untrusted; validation keeps malformed rows out of the file.
- **Alternatives considered**: Trusting the renderer (rejected: privileged boundary);
  truncating oversized snapshots (rejected: silent data loss).

## D-003: Serialized writes and reads

- **Decision**: All writes (append/compaction/delete/clear) go through one promise queue.
  `log:list` and `log:export` wait for the queue before reading; a failed task does not
  poison later tasks.
- **Rationale**: Concurrent append/rewrite can interleave and corrupt JSONL.
- **Alternatives considered**: A lock file (rejected: stale locks); synchronous writes
  (rejected: blocks the main process).

## D-004: 64 MB cap and compaction

- **Decision**: Before appending, if the write would exceed 64 MB, keep at most the newest
  9 999 parseable rows, rewrite atomically (temp file + rename), then append.
- **Rationale**: Bounds disk/memory without losing the most recent history.
- **Alternatives considered**: Rotation into multiple files (rejected: changes the file
  contract and UI); refusing new writes (rejected: history would freeze).

## D-005: Reading and corruption tolerance

- **Decision**: Parse line by line, skip invalid lines, return the newest ≤10 000 rows.
  A missing file yields an empty list.
- **Rationale**: One corrupt tail line must not hide the rest of the history or crash the UI.
- **Alternatives considered**: Failing the whole read (rejected: unusable after one bad
  write); repairing the file on read (rejected: writes during a read could race).

## D-006: CSV export

- **Decision**: Export every parseable row with the fixed header order from
  `shared/print/logSchema.ts`, UTF-8 BOM, CRLF, quoted values containing `,`, `"` or a
  newline. The save dialog is localized and defaults to `打印历史-YYYY-MM-DD.csv` in
  Documents. No rows → `history.empty`; cancel → `status.exportCanceled`.
- **Rationale**: Excel-compatible output and one header source shared with the UI/tests.
- **Alternatives considered**: JSON export (rejected: users need spreadsheets); exporting
  only the 10 000 displayed rows (rejected: reports need the full history — see TODO).

## D-007: Deleting a record

- **Decision**: Delete filters rows by exact `time` and atomically rewrites the file.
- **Rationale**: The UI only has the timestamp as a visible identity; no ID is persisted.
- **Alternatives considered**: Adding a UUID per row (rejected: template/log-format change);
  deleting by index (rejected: races with new writes).

## D-008: Opening the raw file

- **Decision**: `log:open` creates an empty file when missing, then calls
  `shell.openPath`; errors are returned to the UI.
- **Rationale**: Users need the raw JSONL for support/debugging.
- **Alternatives considered**: Opening the containing folder (rejected: less direct).

## D-009: History UI

- **Decision**: The dialog is read-only, sorts newest first, shows the documented columns,
  expands a detail panel (including the snapshot), and provides export/open/clear/delete.
  Statuses map to localized labels; numbers/dates use the locale formatter.
- **Rationale**: Matches the existing UI and keeps the log immutable from the renderer.
- **Alternatives considered**: Editing rows (rejected: log is an audit trail); reprinting
  from history (out of scope).

## D-010: Test prints and schema compatibility

- **Decision**: Test prints do not write a log entry (003 FR-012). The `test` field stays in
  the schema so historical rows remain readable.
- **Rationale**: Avoids polluting history with non-production jobs while keeping old files.
- **Alternatives considered**: Removing the field (rejected: breaks historical rows).

## Open Questions (deferred)

- Delete by `time` removes every row with the same timestamp; whether to add a unique ID is
  `TODO(待确认)`.
- CSV includes rows beyond the 10 000 displayed rows; whether the two limits should match is
  `TODO(待确认)`.
- A truncated tail line is skipped; whether to repair/truncate it proactively is
  `TODO(待确认)`.

# Contract: JSONL Log File

**Feature**: `012-print-history` | **Date**: 2026-10-20

## Location and format

- Path: `app.getPath('userData')/print-log.jsonl`.
- One JSON object per line, terminated by `\n`.
- Each object contains the validated payload plus `app: 'maxlabel'`.
- Blank lines and unparseable lines are ignored on read.

## Write path

```text
validate → queue → if size + new line > 64 MiB: compact → atomic rewrite → append line
```

- All mutations (append/compaction/clear/delete) share one promise queue.
- A failed task is swallowed so later tasks still run.
- Rewrites use a temporary file and `rename` (atomic on the same volume).

## Size cap and compaction

- Cap: 64 MiB (`MAX_PRINT_LOG_BYTES`).
- When a write would exceed the cap:
  1. Parse the existing file.
  2. Keep the newest at most 9 999 parseable rows.
  3. Atomically rewrite the file.
  4. Append the new row.
- If the old file cannot be parsed, compaction keeps only the new row.

## Read path

- `log:list` returns the last 10 000 parseable rows.
- `log:export` reads all parseable rows (no display limit).
- A missing file returns an empty list (and `open` creates it).
- A truncated tail line is treated as invalid and skipped.

## Delete and clear

- `log:delete` filters by exact `time`; duplicate timestamps are removed together
  (`TODO(待确认)` whether to add a unique ID).
- `log:clear` rewrites the file to empty.
- Both are queued and atomic.

## CSV export

- Header order comes from `shared/print/logSchema.ts`.
- UTF-8 BOM + CRLF.
- Values containing `,`, `"` or newline are quoted; quotes are doubled.
- Default file name: `打印历史-YYYY-MM-DD.csv` under Documents.
- The save dialog is localized; a canceled dialog writes nothing.

## Non-goals

- Rotation into multiple files, compression, encryption or cloud sync.
- Changing the JSONL schema or file location.

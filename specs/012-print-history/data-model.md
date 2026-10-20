# Data Model: Print History and Log Management (As-Is)

**Feature**: `012-print-history` | **Date**: 2026-10-20

## PrintLog (persisted)

One JSON object per line in `userData/print-log.jsonl`, with `app: 'maxlabel'`.

| Field | Type | Rules |
|-------|------|-------|
| `time` | string | required, ≤128 chars (ISO time from the executor); delete key |
| `title` | string | template name, ≤255 |
| `mode` | `'driver' \| 'command'` | required |
| `count` | integer | logical label count, 0–100 000 |
| `copies` | integer | copies-per-label, 0–99 999 |
| `physicalCount` | integer? | physical labels, 0–9 999 900 000 |
| `status` | enum? | `completed`/`submitted`/`partial`/`failed`/`canceled`/`unknown` |
| `sentCount` | integer? | labels actually sent, 0–9 999 900 000 |
| `test` | boolean | required; current executor writes `false` only |
| `printer` | string | ≤255 |
| `dataSnapshot` | string[]? | ≤100 000 lines, each ≤1 MiB, total ≤16 MiB |
| `app` | string | constant `maxlabel`, added by the writer |

Invalid fields are rejected before writing (`error.log`); no partial row is written.

## Status semantics

| Value | Meaning |
|-------|---------|
| `completed` | completed (legacy/historical) |
| `submitted` | accepted/submitted to the printer |
| `partial` | some labels sent before a failure |
| `failed` | failed before/without sending |
| `canceled` | user or transport canceled |
| `unknown` | transport outcome unknown |

The UI maps unknown/absent values to the localized “submitted” label.

## PrintHistoryRow (UI view)

Derived from `PrintLog`; no extra persistence.

| Field | Display |
|-------|---------|
| `time` | localized date/time |
| `title` | template name (ellipsized) |
| `mode` | 打印方式 (driver/command) |
| `count` / `copies` | localized numbers |
| `physicalCount` | value, or `count × copies` when absent |
| `sentCount` | value, or `—` when absent |
| `status` | localized status label |
| `test` | 测试 / 正常 |
| `printer` | printer name |
| `dataSnapshot` | detail panel, one line per row |

## CSV export

Fixed header order from `shared/print/logSchema.ts`:

1. 时间
2. 模板
3. 打印方式
4. 数量
5. 单签拷贝
6. 计划标签张数
7. 已发送标签张数
8. 状态
9. 测试打印
10. 打印机

Encoding: UTF-8 BOM, CRLF line endings; values containing `,`, `"` or newline are quoted.

## Storage limits

| Limit | Value |
|-------|-------|
| File size | 64 MiB |
| Rows returned to the UI | newest 10 000 parseable rows |
| Rows retained during compaction | ≤9 999 parseable rows |
| Snapshot lines | ≤100 000 |
| Snapshot line length | ≤1 MiB |
| Snapshot total | ≤16 MiB |

## File lifecycle

```text
print attempt (non-test)
        │  log:print validated
        ▼
queued append ── size + row > 64 MiB ──► compact newest ≤9 999 ──► atomic rewrite ──► append
        │
list/export ── wait for queue ──► read lines ──► skip invalid ──► newest ≤10 000 (list)
delete(time) / clear ── queued ──► filter/empty ──► atomic rewrite
open ── create empty if missing ──► shell.openPath
```

## Relationships

- A `PrintLog` row is produced by one print attempt; test prints are not logged.
- `PrintHistoryDialog` reads rows through `log:list`; it never writes.
- The CSV file is an export of the same rows, not a second source of truth.
- `printJobJournal` is a separate in-flight journal (003) and is not the print history.

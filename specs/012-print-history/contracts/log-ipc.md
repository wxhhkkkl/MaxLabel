# Contract: Print Log IPC

**Feature**: `012-print-history` | **Date**: 2026-10-20

## Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `log:print` | renderer → main | validate and append one print row |
| `log:list` | renderer → main | return the newest ≤10 000 parseable rows |
| `log:export` | renderer → main | save all parseable rows as CSV |
| `log:open` | renderer → main | open the JSONL file in the OS default app |
| `log:clear` | renderer → main | delete all rows |
| `log:delete` | renderer → main | delete rows matching a `time` |

All handlers are registered through the secure main-window IPC path and are allowlisted in
`IPC_CHANNELS`.

## `log:print` payload

```ts
{
  time: string                 // required, ≤128 chars
  title: string                // ≤255
  mode: 'driver' | 'command'
  count: number                // integer 0..100000
  copies: number               // integer 0..99999
  physicalCount?: number       // integer 0..9999900000
  status?: 'completed' | 'submitted' | 'partial' | 'failed' | 'canceled' | 'unknown'
  sentCount?: number           // integer 0..9999900000
  test: boolean
  printer: string              // ≤255
  dataSnapshot?: string[]      // ≤100000 lines, each ≤1 MiB, total ≤16 MiB
}
```

Result: `{ ok: true, path: string }` on success; `{ ok: false, message, messageKey:
'error.log' }` on validation/write failure. Nothing is written on failure.

## `log:list`

Result: `{ ok: true, logs: PrintLog[] }` (newest last in file order; the UI sorts newest
first) or `{ ok: false, message, messageKey: 'error.log' }`. A missing file returns `logs:
[]`.

## `log:export`

Input: optional `language` (`zh-CN`/`en-US`) for the save dialog.
Result: `{ ok: true, path }`, `{ ok: false, message, messageKey: 'history.empty' }` when
there is nothing to export, or a canceled result (`messageKey: 'status.exportCanceled'`).
The file is written only after the user picks a path.

## `log:open`

Result: `{ ok: true, path }` or `{ ok: false, message, messageKey: 'error.log' }`. A missing
file is created empty first.

## `log:clear` / `log:delete`

- `log:clear` truncates the file to empty and returns `{ ok: true }`.
- `log:delete` takes `time: string`, removes every row whose `time` equals it, atomically
  rewrites and returns `{ ok: true }`.
- Both queue behind pending writes; errors return `error.log`.

## Security and lifecycle

- Serial access stays in the main process; the renderer never touches the file path.
- Payloads are validated before any write.
- Writes are serialized; reads/exports wait for the queue.
- Log failures never fail the print job (the executor ignores them).

## Non-goals

- Editing/reprinting from history.
- Adding IPC channels or changing payload names.

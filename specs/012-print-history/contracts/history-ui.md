# Contract: Print History UI

**Feature**: `012-print-history` | **Date**: 2026-10-20

## Entry points

- 查看 → 打印历史记录 (`labelShopMenus`).
- Print dock “打印历史记录” button.

Both open the modal `PrintHistoryDialog`; it is read-only.

## List

- Read immediately on open via `log:list`; sort by `time` descending.
- Columns: 时间、模板、打印方式、数量、单签拷贝、计划张数、已发送、状态、类型、打印机.
- 计划张数 falls back to `count × copies`; 已发送 shows `—` when absent.
- 类型 shows 测试/正常 from the `test` flag.
- Empty history shows the empty-state message and count 0.

## Detail

Clicking a row expands: time, template, mode, type, count, copies, planned/sent counts,
status, printer. If `dataSnapshot` exists, each line is shown with a `#n` prefix; an empty
line shows a localized “empty value” marker.

## Status mapping

| Stored | UI |
|--------|----|
| `partial` | 部分发送 |
| `failed` | 失败 |
| `canceled` | 已取消 |
| `unknown` | 未知 |
| absent / other | 已提交 |

## Actions

| Action | Behaviour |
|--------|-----------|
| 导出 CSV | `log:export` with the active language; success shows the path |
| 打开日志文件 | `log:open`; failure shows a localized error |
| 清空 | `window.confirm`; on confirm `log:clear` and clear the list |
| 删除（row） | `window.confirm` with the timestamp; `log:delete`; reload |
| 关闭 | close the modal |

Errors from IPC are resolved through `localizeIpcMessage` before display.

## Formatting

- Dates/numbers use `formatDateTime`/`formatNumber` with the active language.
- Long template/printer names are ellipsized; the detail panel shows the full value.
- The table scrolls; the modal keeps fixed actions in the footer.

## Non-goals

- Editing rows, reprinting, filtering/searching, or exporting only selected rows.

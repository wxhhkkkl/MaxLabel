# Contract: Renderer ↔ Main IPC

**Feature**: `001-system-baseline` | **Date**: 2026-10-18

Single source of truth: `app/src/shared/ipcContract.ts` (`IPC_CHANNELS`, `MaxLabelAPI`).
Preload exposes only the whitelisted methods from `MaxLabelAPI`. Main handlers are
registered through `secureIpcHandler` / `assertKnownIpcChannel`.

## Channel Inventory

| Group | Channels | Purpose |
|-------|----------|---------|
| Printing | `print-label`, `preview:open`, `print:command`, `command:send-file`, `print:cancel`, `ports:list`, `printers:list`, `export:barcodes`, `barcode:copy` | Driver/native printing, preview, ports, barcode export |
| License / update | `license:status`, `license:activate`, `license:check`, `update:check` | Activation, re-check, version check |
| Cloud | `cloud:register`, `cloud:login`, `cloud:logout`, `cloud:save`, `cloud:list`, `cloud:load`, `cloud:delete`, `cloud:open`, `cloud:databases`, `cloud:database-tables`, `cloud:database-rows`, `cloud-credentials:load/save/clear` | Cloud templates, credentials, cloud databases |
| Shared library | `sharedTemplates:list`, `sharedTemplates:publish`, `sharedTemplates:load`, `sharedTemplates:delete` | Shared template library |
| Templates | `template:save`, `template:open`, `template:openPath`, `template:saveTo`, `template:list`, `template:saveToLib`, `template:delete` | Local template files and library |
| Database | `db:test`, `db:query`, `db:cancel`, `db:save-secret` | ODBC/SQL access and cancellation |
| Logs | `log:print`, `log:list`, `log:export`, `log:clear`, `log:open`, `log:delete` | Print log persistence and management |
| Dialogs / app | `dialog:pickFile`, `dialog:pickDir`, `dialog:confirmClose`, `app:close-requested`, `app:close-window`, `app:config-load`, `app:config-save`, `app:version`, `app:window-title`, `image:read`, `help:open` | Native dialogs, lifecycle, config, help |

## Key Payload Contracts

- `printLabel({ pages: DriverPrintPage[], widthMm, heightMm, printerName? }, jobId?)`:
  each page is either inline SVG (`svg`) or a raster data URL (`dataUrl`), exactly one
  per page; returns `PrintTransportResult`.
- `printCommand({ segments?, text?, encoding: 'utf8'|'gbk', port }, jobId?)`: native
  command bytes; returns `PrintTransportResult`.
- `previewOpen({ dataUrl?, pages?, widthMm, heightMm, truncated? })`: opens the preview window.
- `license.activate(key, serverUrl)` / `license.check(serverUrl)` / `license.status()`:
  returns `LicenseStateDto`.
- `cloud.*`: token-authenticated calls returning `{ ok, error?, data? }`.
- `template.*`: save/open with dialog-granted paths; save returns `{ canceled, filePath?, message? }`.
- `db.query(conn, sql, requestId?)`: returns rows as string records; `db.cancel(requestId)`.
- `logPrint(payload)`: resolved data snapshot plus status and sent count.

## Security Rules

1. All privileged operations MUST be registered in `IPC_CHANNELS`; unknown channels are
   rejected by `assertKnownIpcChannel`.
2. Handlers MUST verify the sender is the main window (`senderGuard`) and validate
   payloads (size, extension, port, database config) in `ipc/validation.ts`.
3. The renderer cannot read or overwrite an arbitrary path string: paths are only usable
   after being granted by a system dialog (`ipc/pathAccess.ts`).
4. Secrets (database passwords, cloud tokens) never cross back to the renderer except
   through the dedicated credential APIs and are stored with `safeStorage`.
5. Print jobs accept a `jobId`; cancellation targets that ID and must not affect a later job.

Evidence: `app/src/shared/ipcContract.ts`, `app/src/preload/index.ts`,
`app/src/main/ipc/senderGuard.ts`, `validation.ts`, `pathAccess.ts`.

# Contract: Transport

**Feature**: `003-printing-pipeline` | **Date**: 2026-10-18

## Port Matrix

| Port | Behavior |
|------|----------|
| `driver` | Electron/Windows driver printing; raster pages submitted as one job |
| `file` | Merge all batches into one command file |
| `tcp` | Socket write; accepted on write completion, failed on connect error, unknown on close after write |
| `com` | Windows PowerShell serial write with framing; missing port fails |
| `usb` | Windows raw queue write; only confirmed completion is accepted |
| `bluetooth` | COM-based Bluetooth SPP; missing COM fails |
| `lpt` | Windows device file `\\.\LPTn`; invalid name fails |
| `cloudbox` | TCP rules applied to the cloud-box address |

## Batching

- TCP/USB/COM/Bluetooth: at most 24 pages per batch.
- File: all pages merged; preamble/postamble once.
- Driver: all pages submitted as one system print task.
- Each confirmed batch contributes to sent counts and log snapshots; failed/unknown
  batches do not.

## Status Semantics

- `accepted`: transport accepted the bytes/job.
- `failed`: connection/port/driver rejected the job.
- `unknown`: bytes may have been sent but completion is unconfirmed (socket closed after
  write, incomplete USB queue, printer unacknowledged).
- `canceled`: user aborted; later jobs must be unaffected.
- Multi-batch jobs with some confirmed batches log `partial` and the confirmed sent count.

## Cleanup

Temporary command/serial files MUST be removed on success and failure. Abort signals MUST
destroy sockets/processes and leave active-job maps clean.

Evidence: `app/src/main/printing/commandTransport.ts`,
`app/src/renderer/src/features/printing/printExecutor.ts`,
`tests/integration/main/printing-transport.test.ts`,
`tests/integration/renderer/print-executor.test.ts`.

# Contract: Print Output Pipeline

**Feature**: `001-system-baseline` | **Date**: 2026-10-18

## Pipeline

```text
LabelDoc + DataCtx
  └─ resolvePrintScene ──> ResolvedPrintScene (per logical label)
        └─ buildPrintPlan ──> PrintPlan (counts, copies, slots, record indices)
              └─ resolvePrintJob ──> ResolvedPrintJob { plan, pages[] }
                    ├─ Windows driver: raster pages (data URLs)
                    └─ TSPL / ZPL / CPCL: command bytes
```

- Data-source evaluation, group expansion, hidden/`suppressPrint` filtering, label index
  and copy count are computed **before** protocol adapters run.
- Protocol adapters MUST NOT re-resolve data sources or maintain a second geometry model.
- Preview and driver printing consume the same scene; native printing consumes the same
  scene except where a page bitmap fallback is required.

## Driver Print Payload

```ts
printLabel({
  pages: Array<{ dataUrl: string; copies?: number }>,
  widthMm: number,
  heightMm: number,
  printerName?: string
}, jobId?)
```

## Native Command Payload

```ts
printCommand({
  segments?: Array<{ type: 'text'; str: string } | { type: 'bin'; data: Uint8Array }>,
  text?: string,
  encoding: 'utf8' | 'gbk',
  port: PortConfig
}, jobId?)
```

- Encoding is UTF-8 or GBK (GB18030 via `iconv-lite`).
- Ports: file, TCP, COM, USB virtual serial, Bluetooth SPP, Windows driver.
- DPI conversion: 203 / 300 / 600 dpi.

## Results and Failure Semantics

```ts
PrintTransportResult {
  ok: boolean
  canceled?: boolean
  status?: 'accepted' | 'failed' | 'unknown' | 'canceled'
  bytesWritten?: number
  message?: string
}
```

- `accepted`: transport accepted the bytes/job.
- `unknown`: the connection dropped after sending; the log records this explicitly.
- `canceled`: the user cancelled the job; later jobs must be unaffected.
- If a page requires bitmap fallback and the bitmap is not ready, sending MUST be blocked.

## Logging

Print logs use the resolved snapshot, not a second evaluation of sources. Each entry
records time, template, mode, count, copies, planned labels, sent labels, status, test
flag, printer and data snapshot. Logs are JSONL under `userData`.

Evidence: `app/src/shared/print/scene.ts`, `plan.ts`, `engine.ts`, `tspl.ts`, `zpl.ts`,
`cpcl.ts`, `capabilities.ts`, `compat.ts`, `logSchema.ts`,
`app/src/main/printing/commandTransport.ts`, `app/src/shared/ipcContract.ts`.

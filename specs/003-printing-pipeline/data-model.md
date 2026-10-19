# Data Model: Printing Pipeline and Devices (As-Is)

**Feature**: `003-printing-pipeline` | **Date**: 2026-10-18

This is a descriptive model of the existing print entities. It does not propose new
fields.

## Data Flow

```text
LabelDoc + DataCtx
  └─ resolvePrintScene ──> ResolvedPrintScene (one logical label)
        └─ buildExecutablePrintPlan ──> PrintPlan
              └─ resolvePrintJob ──> ResolvedPrintJob { plan, pages[] }
                    ├─ driver: raster pages (data URLs)
                    └─ native: CommandPayload (segments, encoding, port)
                          └─ PrintTransportResult
                                └─ PrintLog (JSONL snapshot)
```

## ResolvedPrintScene

| Field | Type | Meaning |
|-------|------|---------|
| `widthMm` / `heightMm` | number | Physical label size |
| `labelIndex` | number | 1-based label index in the job |
| `copy` | number | Copy index |
| `primitives` | `ResolvedPrintPrimitive[]` | Resolved objects |
| `labelShape?` | `PaperShape` | rect/roundRect/ellipse/disc |
| `paperGeometry?` | `PaperGeometry` | Holes/inner diameter/corner radius |
| `labelCells?` | `{x,y,widthMm,heightMm}[]` | Imposition cells |
| `colorIndexTable?` | string[] | Colour index table |
| `pageBitmap?` | `MonoBitmap` | Full-page fallback bitmap |

`ResolvedPrintPrimitive` has `kind` (`text`/`barcode`/`rfid`/`rect`/`line`/`ellipse`/
`table`/`image`), the resolved object, resolved value, optional mono bitmap, label index
and context.

Invariants:

- Group children are flattened.
- Hidden objects are never included; `suppressPrint` is excluded by default.
- Native output filters to objects fully inside the label; preview keeps all.
- `context.recordRow` contains the current row; `context.datasets` rows are emptied.

Evidence: `app/src/shared/print/scene.ts`, `tests/unit/shared/print/scene.test.ts`.

## PrintPlan

| Type | Fields |
|------|--------|
| `PrintPlanInput` | `test`, `requestedCount`, `recordStart`, `dataset?`, `cellsPerPage`, `startSlot?`, `recordIndices?`, `defaultCopies`, `firstCopies?`, `copyField?`, `physicalLabelLimit?` |
| `PrintPlan` | `pages`, `logicalLabelCount`, `physicalPageCount`, `physicalLabelCount`, `serialAdvanceCount`, `cellsPerPage`, `startSlot`, `recordStart`, `recordCount`, `warnings` |
| `PrintPlanPage` | `pageIndex`, `cells`, `copies` |
| `PrintPlanCell` | `logicalIndex`, `recordIndex`, `labelIndex`, `copies`, `slotIndex` |

Invariants:

- Copies multiply physical labels but not serial advancement.
- `startSlot` leaves leading slots empty on the first page.
- Deduplication preserves first-seen order and original row indices.
- Empty dataset produces zero pages/labels and blocks printing.
- Limits: 100000 logical labels, 99999 copies, 1000000 physical labels.

Evidence: `app/src/shared/print/plan.ts`, `limits.ts`,
`tests/unit/shared/print/plan.test.ts`.

## PrinterConfig and PortConfig

**PrinterConfig**: `driver` (`tspl`/`zpl`/`cpcl`), `profile?`, `model?`, `firmware?`,
`dpi`, `speed`, `density`, `printMode` (`default`/`thermal`/`transfer`), `labelType`
(`default`/`gap`/`continuous`/`mark`), `topOffsetMm`, `mediaHandle`
(`tear`/`peel`/`cut`/`none`), `backfeedMm`, `preCmd?`, `contentCmd?`, `postCmd?`,
`saveAsDefault?`, `port`, `printerName?`.

**PortConfig**: `type` (`driver`/`file`/`tcp`/`com`/`usb`/`bluetooth`/`lpt`/`cloudbox`),
`tcpHost`, `tcpPort`, `comPort`, `usbPort`, `lptPort`, `baudRate`, `dataBits`, `parity`,
`stopBits`, `flowControl`, `encoding` (`utf8`/`gbk`).

Evidence: `app/src/shared/domain/printer.ts`, `app/src/main/ipc/validation.ts`,
`tests/contracts/ipc-contract.test.ts`.

## Command Payload and Transport Result

- **CommandPayload**: `segments?` (text/bin), `text?`, `encoding`, `port`.
- **CommandSegment**: `{ type: 'text', str }` or `{ type: 'bin', data: Uint8Array }`.
- **PrintTransportResult**: `ok`, `canceled?`, `status?`
  (`accepted`/`failed`/`unknown`/`canceled`), `bytesWritten?`, `message?`.
- **PrintJob** (application service): plan pages, resolved pages, batch index, sent
  logical/physical counts, serial commit result.

Evidence: `app/src/shared/ipcContract.ts`,
`app/src/main/printing/commandTransport.ts`,
`tests/integration/main/printing-transport.test.ts`.

## Print Log

Fields: time, title, mode, count, copies, planned physical count, sent count, status
(`completed`/`submitted`/`partial`/`failed`/`canceled`/`unknown`), test flag, printer,
resolved data snapshot. Persisted as JSONL under Electron `userData`.

Evidence: `app/src/shared/print/logSchema.ts`, `app/src/main/ipc/registerLogIpc.ts`,
`tests/integration/renderer/print-executor.test.ts`.

## Printer Catalog

`PrinterCatalogEntry`: `brand`, `model`, `engines` (`tspl`/`zpl`/`cpcl`), `ports`, `dpi`,
`note`. 125 entries / 39 brand filters; unknown brands use TSPL→ZPL→CPCL best effort.

Evidence: `app/src/shared/domain/printerCatalog.generated.ts`,
`tests/unit/shared/domain/printer-catalog.test.ts`.

## Limits and Invariants

| Constraint | Value |
|------------|-------|
| Logical labels | 100000 |
| Copies per label | 99999 |
| Physical labels | 1000000 |
| Native batch pages | 24 |
| Command file size | 64 MB |
| Command segments | 100000 |
| Driver payload | `MAX_DRIVER_DATA_BYTES` |

Additional invariants:

- Protocol adapters consume resolved pages; they do not call data-source resolvers.
- Bitmap fallback blocks sending if the page bitmap is missing.
- Serial advancement happens only for confirmed output; unknown/partial results use
  confirmed counts.
- Test print never writes a log or advances serials.

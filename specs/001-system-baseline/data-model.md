# Data Model: MaxLabel Desktop System Baseline (As-Is)

**Feature**: `001-system-baseline` | **Date**: 2026-10-18

This document records the entities that already exist in the codebase. It is descriptive,
not a proposal. Field names are the actual TypeScript property names.

## Entity Relationships

```text
LabelDoc 1 ── * LabelObject
LabelDoc 1 ── 0..1 PrinterConfig ── 1 PortConfig
LabelDoc 1 ── * Dataset
LabelDoc 1 ── * DbConnectionConfig
LabelDoc 0..1 ── globalScript
LabelObject 1 ── 1 DataSource (text/barcode/RFID)
DataSource ──> Dataset (database kind)
LabelDoc + DataCtx ──> PrintPlan ──> ResolvedPrintScene (per page)
WorkspaceTab 1 ── 1 LabelDoc
LicenseState / PrintLog are application-level, not part of LabelDoc
```

## LabelDoc

The complete label document persisted in `.msdx` or legacy `.json`.

| Field | Type | Meaning |
|-------|------|---------|
| `version` | number | Document model version; older versions migrate on load |
| `name` | string | Template name |
| `formatKind` | `'preset' \| 'custom'` | Preset page settings are read-only |
| `widthMm` / `heightMm` | number | Physical label size in millimetres |
| `objects` | `LabelObject[]` | Drawable objects, including groups |
| `printer?` | `PrinterConfig` | Printer binding saved with the template |
| `datasets?` | `Record<string, Dataset>` | Imported data sets |
| `connections?` | `Record<string, DbConnectionConfig>` | Database connections (passwords redacted on save) |
| `remark?` | string | Template remark |
| `globalScript?` | string | LabelShop-compatible template lifecycle script |
| `keyboardOrder?` | string[] | Order of keyboard-input prompts |
| `layout?` | object | Rows, columns, gaps, paper shape, page size, holes, print order, offsets |
| `orientation?` | `0 \| 90 \| 180 \| 270` | Page orientation |
| `thumb?` | string | Template thumbnail |
| `colorIndexTable?` | string[] | Colour index table used by colour-change modes |

`layout` contains: `rows`, `cols`, `rowGapMm`, `colGapMm`, `shape`, `pageWidthMm?`,
`pageHeightMm?`, `pagesPerBox?`, `cornerRadiusMm?`, `labelColor?`, `innerDiameterMm?`,
`innerShape?`, `printOrder?` (`row`/`col`), `labelPrintDirection?`, `startPos?`,
`offsetXMm?`, `offsetYMm?`, `pageLeftMm?`, `pageTopMm?`.

Evidence: `app/src/shared/domain/document.ts` (`LabelDoc`), `paper.ts` (`PaperShape`,
`PaperHoleShape`).

## LabelObject

### Base fields

Every object has: `id`, `type`, `x`, `y`, `w`, `h`, `rotation`, `visible?`, `locked?`,
`suppressPrint?`, `flipX?`, `flipY?`, `note?`, `name?`, `backgroundTransparent?`.
Coordinates and size are in millimetres.

### Variants

| Type | Key fields | Notes |
|------|------------|-------|
| `text` | `source`, `fontFamily`, `fontSize`, `bold`, `italic`, `underline`, `strikeout`, `align`, `color`, `format`, `substr`, `charTemplate`, `printerFont`, `arc`, `arcAngle`, `arcRadius` | Supports printer built-in fonts and arc text |
| `barcode` | `symbology`, `source`, `showText`, `fontFamily`, `fontSize`, `color`, `reductionMm`, `format`, `substr` | Symbology names defined in the editor |
| `rfid` | `bank` (`EPC`/`USER`/`TID`), `source`, `subSources`, `lock`, `accessPwd`, `killPwd`, `startBlock`, `dataType`, `lockOp`, `accessControl` | RFID write/lock options |
| `rect` | `fill`, `stroke`, `strokeWidth`, `shape`, `cornerRadius`, `fillEnabled` | |
| `line` | `stroke`, `strokeWidth` | |
| `ellipse` | `fill`, `stroke`, `strokeWidth`, `fillEnabled` | |
| `table` | `rows`, `cols`, `borderWidth`, `borderColor`, `colWidths` | |
| `image` | `src`, `imgType`, `imageFit`, `keepAspect`, image alignment/percentage fields | Embedded, linked or data-source images |
| `group` | `children: LabelObject[]` | Groups are expanded before printing |

Evidence: `app/src/shared/domain/objects.ts`.

## DataSource

Seven variants, all optional `sharedName`:

| Kind | Key fields | Behavior |
|------|------------|----------|
| `constant` | `value` | Fixed text |
| `serial` | `prefix`, `start`, `step`, `digits`, `current`, `charset`, `repeat`, `repeatBasis`, `resetEachRecord`, `initialValueSource` | Advances per record or per label; written back after print |
| `date` | `format`, `offset` | Offset in days |
| `time` | `format`, `offset`, `region` | Offset in minutes; region-based clock |
| `database` | `dataset`, `field`, `connectionId`, `recordOffset` | Reads the current dataset row |
| `script` | `code`, `language`, `scope` | Restricted interpreter; hooks and built-in variables |
| `keyboard` | `label`, `inputDevice`, `weighProtocol`, `weighPort`, `weighBaud`, `weighUnit`, `weighDecimals`, `weighAutoPrint`, `weighUnitConv` | Keyboard or electronic-scale input |

Evidence: `app/src/shared/domain/datasource.ts`.

## Dataset and Database Connection

- **Dataset**: `{ name, columns: string[], rows: string[][] }`.
- **DbConnectionConfig**: `id`, `name`, `driver` (`sqlserver`/`mysql`/`sqlite`/`dsn`),
  `authMode`, `dsn`, `server`, `database`, `user`, `password?`, `filePath`, `timeoutSec`,
  `datasetName`, `tableName`, `autoRefresh`, `sql`.
- Password is stored via `safeStorage`, not in the template; template serialization
  redacts `password`.

Evidence: `app/src/shared/domain/datasource.ts` (`Dataset`),
`app/src/shared/domain/printer.ts` (`DbConnectionConfig`),
`app/src/main/ipc/registerTemplateIpc.ts` (`redactTemplateJson`),
`app/src/main/connectionSecrets.ts`.

## PrinterConfig and PortConfig

**PrinterConfig**: `driver` (`tspl`/`zpl`/`cpcl`), `profile?`, `model?`, `firmware?`,
`dpi`, `speed`, `density`, `printMode` (`default`/`thermal`/`transfer`),
`labelType` (`default`/`gap`/`continuous`/`mark`), `topOffsetMm`,
`mediaHandle` (`tear`/`peel`/`cut`/`none`), `backfeedMm`, `preCmd?`, `contentCmd?`,
`postCmd?`, `saveAsDefault?`, `port`, `printerName?`.

**PortConfig**: `type` (`driver`/`file`/`tcp`/`com`/`usb`/`bluetooth`), `tcpHost`,
`tcpPort`, `comPort`, `usbPort`, `baudRate`, `dataBits`, `parity`, `stopBits`,
`flowControl`, `encoding` (`utf8`/`gbk`), plus legacy parallel port fields.

Default printer: TSPL, 203 dpi, speed 4, density 8, thermal, gap labels, tear-off,
Windows driver port.

Evidence: `app/src/shared/domain/printer.ts`.

## Print Plan and Resolved Scene

- **PrintPlanInput**: `test`, `requestedCount`, `recordStart`, `dataset?`, `cellsPerPage`,
  `startSlot?`, `recordIndices?`, `defaultCopies`, `firstCopies?`, `copyField?`,
  `physicalLabelLimit?`.
- **PrintPlan**: `pages: PrintPlanPage[]`, `logicalLabelCount`, `physicalPageCount`,
  `physicalLabelCount`, `serialAdvanceCount`, `cellsPerPage`, `startSlot`, `recordStart`,
  `recordCount`, `warnings`.
- **PrintPlanCell**: `logicalIndex`, `recordIndex`, `labelIndex`, `copies`, `slotIndex`.
- **ResolvedPrintScene**: `widthMm`, `heightMm`, `labelIndex`, `copy`, `primitives`,
  `labelShape?`, `paperGeometry?`, `labelCells?`, `colorIndexTable?`, `pageBitmap?`.
- **ResolvedPrintPrimitive**: `kind` (`text`/`barcode`/`rfid`/`rect`/`line`/`ellipse`/
  `table`/`image`), the resolved object, resolved value, optional bitmap, label index and
  `DataCtx`.
- **ResolvedPrintJob**: `plan`, `pages` (each a plan page + scene),
  `totalPhysicalLabelCount`.

Limits: 100,000 logical labels, 99,999 copies, 1,000,000 physical labels.

Evidence: `app/src/shared/print/plan.ts`, `scene.ts`.

## Template Envelope

`.msdx` is a versioned JSON envelope:

```json
{
  "format": "maxlabel-msdx",
  "version": 2,
  "app": "MaxLabel",
  "doc": { }
}
```

- `DOCUMENT_MODEL_VERSION` governs migration; a document version above the current
  maximum is rejected.
- Legacy bare `LabelDoc` JSON is accepted.
- `redactDocumentSecrets` removes database passwords before serialization.
- LabelShop `.lsdx` files are imported through a separate import path.

Evidence: `app/src/renderer/src/io/msdx.ts`, `app/src/renderer/src/io/lsdxImport.ts`,
`app/src/shared/domain/document.ts` (`migrateDocument`, `normalizeDocument`,
`redactDocumentSecrets`).

## Application-Level Entities

- **LicenseState**: `active`, `machineId`, `holder`, `key?`, `expiresAt?`, `lastCheckAt?`.
  Evidence: `app/src/main/license.ts`, `app/src/shared/ipcContract.ts`.
- **PrintLog**: time, title, mode, count, copies, physical count, status
  (`completed`/`submitted`/`partial`/`failed`/`canceled`/`unknown`), sent count, test
  flag, printer, resolved-data snapshot. Persisted as JSONL.
  Evidence: `app/src/shared/print/logSchema.ts`, `app/src/main/ipc/registerLogIpc.ts`.
- **WorkspaceTab**: `key`, `path?`, `doc`, `revision`, `dirty`.
  Evidence: `app/src/renderer/src/features/workspace/useDocumentWorkspace.ts`.
- **DocumentHistory**: per-document undo/redo stack.
  Evidence: `app/src/renderer/src/features/workspace/useDocumentHistory.ts`.

## Validation Rules (as implemented)

- A document version above the supported maximum is rejected; older versions are migrated.
- Script source is limited to 256 KB; strings are limited to 1 MB; forbidden host
  identifiers are rejected.
- Print counts are positive integers within the limits above.
- Saving to a path already open in another tab is rejected.
- Database passwords are removed from serialized templates and stored via `safeStorage`.
- File access is only permitted for paths granted by a system dialog.

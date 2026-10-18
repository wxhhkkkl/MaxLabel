# Legacy Assertion Inventory

**Feature**: `002-test-architecture` | **Created**: 2026-10-18

> **Status**: all P1 rows are `ported`. The legacy suite in `app/scripts` was removed on
> 2026-10-18; only build/generator/installer tooling remains. This file is kept as the
> equivalence record.

Every legacy P1 assertion must map to a new test or an explicit, owner-approved
retirement before `app/scripts` can be removed (spec FR-016, FR-030–FR-032).

Status values: `planned` → `ported` → `verified`; `retire` requires an approval note.

## Print pipeline

| ID | Behavior | Legacy source | New test target | Decision | Status |
|----|----------|---------------|-----------------|----------|--------|
| PRINT-1 | One resolved scene feeds all output paths; adapters do not re-resolve | `print-engine.test.ts` scene checks | `tests/unit/shared/print/scene.test.ts` | port | ported |
| PRINT-2 | Hidden/suppressPrint filtering; native keeps only fully-inside objects; preview keeps all | `print-engine.test.ts` D-06/D-07 | `tests/unit/shared/print/scene.test.ts` | port | ported |
| PRINT-3 | Scene snapshot keeps current row only, not the full dataset | `print-engine.test.ts` snapshot check | `tests/unit/shared/print/scene.test.ts` | port | ported |
| PRINT-4 | PrintPlan count × copies, cellsPerPage, startSlot, limits, dedupe, test print | `print-engine.test.ts` plan block | `tests/unit/shared/print/plan.test.ts` | port | ported |
| PRINT-5 | Imposition geometry: gaps, print order, start position, offsets | `print-engine.test.ts` D-8 | `tests/unit/shared/print/plan.test.ts` | port | ported |
| PRINT-6 | Auto-rotation preserves physical sheet and source document | `print-engine.test.ts` auto-rotate | `tests/unit/shared/print/scene.test.ts` | port | ported |
| PRINT-7 | TSPL contract (size, density, media, barcode, text, RFID, bitmap) | `print-engine.test.ts` TSPL blocks | `tests/unit/shared/print/tspl.test.ts` | port | ported |
| PRINT-8 | ZPL contract (^XA/^XZ, ^PW, fonts, escaping, RFID) | `print-engine.test.ts` ZPL blocks | `tests/unit/shared/print/zpl.test.ts` | port | ported |
| PRINT-9 | CPCL contract (header, page width, barcode, FORM/PRINT) | `print-engine.test.ts` CPCL blocks | `tests/unit/shared/print/cpcl.test.ts` | port | ported |
| PRINT-10 | 203/300/600 DPI conversions preserve physical dimensions | `print-engine.test.ts`, `render-regression.ts` | print protocol tests | port | ported |
| PRINT-11 | Byte-exact protocol goldens (length + SHA-256 + tokens) | `print-engine.test.ts` snapshot | `tests/contracts/protocol-golden.test.ts` | port | ported |
| PRINT-12 | Capability decisions force rasterization; bitmap cache invalidation | `print-engine.test.ts`, `render-regression.ts` | `tests/unit/shared/print/capabilities.test.ts` + E2E | port | ported |
| PRINT-13 | Executor orchestration, batching, partial/unknown serial behavior | `printing-lifecycle-regression.cjs` | `tests/integration/renderer/print-executor.test.ts` | port | ported |
| PRINT-14 | Script hook failure blocks submission; no partial publication | `printing-lifecycle-regression.cjs` | `tests/integration/renderer/print-executor.test.ts` | port | ported |
| PRINT-15 | Image/Chinese/table/ellipse/RFID/font device-specific output | `print-engine.test.ts` | protocol tests | port | ported |
| PRINT-16 | Printer settings round-trip and TSPL/ZPL job mapping | `print-engine.test.ts` | `tests/unit/shared/print/*` | port | ported |

## Data sources and scripting

| ID | Behavior | Legacy source | New test target | Decision | Status |
|----|----------|---------------|-----------------|----------|--------|
| DATA-1 | Serial prefix/step/digits/repeat/basis/initial value/advance | `print-engine.test.ts`, `printing-lifecycle-regression.cjs` | `tests/unit/shared/domain/datasource.test.ts` | port | ported |
| DATA-2 | Fixed-clock date/time formats and offsets | `print-engine.test.ts` | `tests/unit/shared/domain/datasource.test.ts` | port | ported |
| DATA-3 | All seven source kinds + object formatting/substring | `print-engine.test.ts`, `editor-operations.test.ts` | `tests/unit/shared/domain/datasource.test.ts` | port | ported |
| DATA-4 | VB/JS interpreter semantics and precedence | `script-runtime-regression.cjs` | `tests/unit/shared/domain/scriptRuntime.test.ts` | port | ported |
| DATA-5 | Sandbox rejection, quotas, runtime-error containment | `script-runtime-regression.cjs` | `tests/unit/shared/domain/scriptRuntime.test.ts` | port | ported |
| DATA-6 | Shared variables, typed script state, lifecycle isolation | `script-runtime-regression.cjs` | `tests/unit/shared/domain/scriptRuntime.test.ts` | port | ported |
| DATA-7 | DB refresh cancellation, latest-request-wins, field rename | `persistence-regression.cjs` | `tests/integration/renderer/data-management.test.ts` | port | ported |
| DATA-8 | Delimited import: comma/tab/semicolon, quotes, BOM, GB18030 | `print-engine.test.ts`, `editor-operations.test.ts` | `tests/unit/renderer/dataImport.test.ts` | port | ported |
| DATA-9 | PowerShell ODBC UTF-8/BOM/non-BMP bridge | `db-regression.cjs` | `tests/integration/main/db.test.ts` | port | ported |

## Document model and persistence

| ID | Behavior | Legacy source | New test target | Decision | Status |
|----|----------|---------------|-----------------|----------|--------|
| DOC-1 | `.msdx` round-trip, version rejection, legacy field migration | `print-engine.test.ts` | `tests/unit/shared/domain/document.test.ts` | port | ported |
| DOC-2 | Normalization: DPI clamp, password strip, duplicate columns, table merges | `print-engine.test.ts` | `tests/unit/shared/domain/document.test.ts` | port | ported |
| DOC-3 | Save queue, cancel/failure handling, duplicate-path rejection | `print-engine.test.ts`, `persistence-regression.cjs` | `tests/unit/renderer/documentPersistence.test.ts` | port | ported |
| DOC-4 | Template IPC: select writes nothing, saveTo writes once | `persistence-regression.cjs` | `tests/integration/main/template-ipc.test.ts` | port | ported |
| DOC-5 | Undo/redo bounds, redo invalidation, serial-progress rebasing | `document-history.test.ts` | `tests/unit/renderer/document-history.test.ts` | port | ported |
| DOC-6 | LSDX import: dimensions, group, table, RFID, rounded/hole | `render-regression.ts` | `tests/contracts/lsdx-import.test.ts` | port | ported |
| DOC-7 | Barcode export transaction, rollback, naming, scripted scenes | `export-regression.cjs` | `tests/unit/renderer/barcodeExport.test.ts` | port | ported |

## Editor operations and geometry

| ID | Behavior | Legacy source | New test target | Decision | Status |
|----|----------|---------------|-----------------|----------|--------|
| EDIT-1 | Align/distribute uses first-selected reference object | `editor-operations.test.ts` | `tests/unit/renderer/operations.test.ts` | port | ported |
| EDIT-2 | Group/ungroup transform preservation and bounds | `editor-operations.test.ts` | `tests/unit/renderer/operations.test.ts` | port | ported |
| EDIT-3 | Rotation-aware client→canvas mapping and resize constraints | `editor-operations.test.ts` | `tests/unit/renderer/operations.test.ts` | port | ported |
| EDIT-4 | Availability matrix, table helpers, factory defaults | `editor-operations.test.ts` | `tests/unit/renderer/operations.test.ts` | port | ported |
| EDIT-5 | Fabric→model group geometry round-trip | `editor-geometry.test.ts` | `tests/unit/renderer/editor-geometry.test.ts` | port | ported |
| EDIT-6 | Workspace rulers, zoom, fit, context menu, clipping | `workspace-regression.tsx` | `tests/e2e/` (reproducible parts) | port/retire | ported |
| EDIT-7 | Editor/preview pixel parity, paper shapes/holes, bitmap cache | `render-regression.ts` | `tests/e2e/` + unit capability tests | port/retire | ported |

## Contracts and other P1 locks

| ID | Behavior | Legacy source | New test target | Decision | Status |
|----|----------|---------------|-----------------|----------|--------|
| IPC-1 | IPC payload/port/db validation and path/sender guards | `print-engine.test.ts` | `tests/contracts/ipc-contract.test.ts` | port | ported |
| BARC-1 | Symbology charset/check-digit/options rules | `barcode-charset.test.ts`, `barcode-spec.test.ts` | `tests/unit/shared/domain/barcode-*.test.ts` | port | ported |
| PRINT-CFG-1 | Printer catalog (125) and label formats (275) | `printer-catalog.test.ts`, `label-formats.test.ts` | `tests/unit/shared/domain/printer-catalog.test.ts` | port | ported |
| COLOR-1 | Six colour modes, granularity, deterministic random, native unsupported | `color-change.test.ts` | `tests/unit/shared/domain/color-change.test.ts` | port | ported |

## Retirement Log

No assertion has been retired. Any future `retire` decision must include the owner, date,
reason, and a link to the replacement coverage or an explicit acceptance of the gap.

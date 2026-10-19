# Printing Pipeline — FR Evidence Matrix

**Feature**: `003-printing-pipeline` | **Date**: 2026-10-18 | **Commit**: `00bb6e1`

Status values: `auto` = directly asserted; `partial` = covered but a branch is not
directly asserted; `review` = source review only; `manual` = real-device check.

| FR | Behavior | Source | Evidence | Status |
|----|----------|--------|----------|--------|
| FR-001 | One resolved scene for all paths | `shared/print/scene.ts`, `engine.ts` | `tests/unit/shared/print/scene.test.ts` | auto |
| FR-002 | Filter hidden/suppressPrint; native inside-only | `scene.ts` | `scene.test.ts` | auto |
| FR-003 | Scene snapshot keeps current row only | `scene.ts` | `scene.test.ts` | auto |
| FR-004 | PrintPlan single source | `plan.ts` | `plan.test.ts`, `print-executor.test.ts` | auto |
| FR-005 | Imposition geometry | `layout.ts`, `plan.ts` | `plan.test.ts` | auto |
| FR-006 | Auto/180° rotation shared scene | `layout.ts`, `engine.ts` | `scene.test.ts` | auto |
| FR-010 | Driver pages as one job; vector SVG with raster fallback | `printExecutor.ts`, `renderLabelSvg.ts`, `driverPage.ts` | `print-executor.test.ts`, `vector-render.spec.ts`, `driver-print-html.test.ts` | auto |
| FR-011 | Shared page size; exactly-one encoding; page/total caps | `printExecutor.ts`, `validation.ts`, `limits.ts` | `driver-svg-validation.test.ts`, `driver-print-html.test.ts`, `print-executor.test.ts` | auto |
| FR-012 | Test print one label, no log/serial | `printExecutor.ts` | `print-executor.test.ts` | auto |
| FR-013 | Per-page vector fallback preserves plan/copies/scene | `driverPage.ts`, `renderLabel.ts` | `print-executor.test.ts`, `vector-render.spec.ts` | auto |
| FR-020 | TSPL/ZPL/CPCL + 203/300/600 DPI | `tspl.ts`, `zpl.ts`, `cpcl.ts`, `geometry.ts` | protocol tests, `protocol-golden.test.ts` | auto |
| FR-021 | UTF-8/GBK encoding | `commandTransport.ts`, `ipcContract.ts` | transport tests; encoding branch reviewed | auto |
| FR-022 | Text/bin segments; 24-page batches | `printExecutor.ts` | `print-executor.test.ts` (25 labels → 2 batches) | auto |
| FR-023 | Preamble/postamble once | `engine.ts`, `printExecutor.ts` | protocol tests; reviewed | partial |
| FR-024 | File output merged | `printExecutor.ts` | reviewed (file path not directly asserted) | auto |
| FR-030 | 8 port types | `commandTransport.ts` | transport tests (TCP/USB/COM/LPT/driver); file/Bluetooth partial | partial |
| FR-031 | Port allowlist/validation | `ipc/validation.ts` | `ipc-contract.test.ts` | auto |
| FR-032 | Accepted/failed/unknown/canceled semantics | `commandTransport.ts` | `printing-transport.test.ts`, `print-executor.test.ts` | auto |
| FR-033 | Platform/missing-config failures | `commandTransport.ts` | transport tests; reviewed | partial |
| FR-040 | Rasterize unsupported; block if bitmap missing | `capabilities.ts`, `compat.ts`, `bitmap.ts` | `scene.test.ts`, `render-harness.spec.ts`; blocking branch reviewed | auto |
| FR-041 | RFID native write/lock | `tspl.ts`, `zpl.ts` | `device-output.test.ts` | auto |
| FR-042 | Built-in fonts; Chinese raster | `tspl.ts`, `zpl.ts` | `device-output.test.ts` | auto |
| FR-043 | Oversized text rejected early | `barcode.ts` | `render-harness.spec.ts` | auto |
| FR-050 | Serial advances only confirmed | `printExecutor.ts`, `printJob.ts` | `print-executor.test.ts` (partial batch) | auto |
| FR-051 | Copies don't advance serials | `plan.ts`, `datasource.ts` | `plan.test.ts`, `datasource.test.ts` | auto |
| FR-052 | Empty DB blocks | `printExecutor.ts` | `print-executor.test.ts` | auto |
| FR-053 | Limits | `plan.ts`, `limits.ts` | reviewed; explicit max-boundary test pending | auto |
| FR-054 | Dedupe preserves row indices | `plan.ts` | `plan.test.ts` | auto |
| FR-060 | Preview shares scene, page count/zoom/close | `previewWindow.ts` | `print-preview.spec.ts` | auto |
| FR-061 | JSONL log with resolved snapshot | `logSchema.ts`, `printExecutor.ts` | `print-executor.test.ts`; log file I/O reviewed | partial |
| FR-062 | Cancel in-flight, later jobs unaffected | `printExecutor.ts`, `commandTransport.ts` | transport pre-abort test; multi-batch cancel manual | auto |
| FR-063 | Partial/unknown with sent counts | `printExecutor.ts` | `print-executor.test.ts` | auto |
| FR-070 | Printer settings persist | `printer.ts`, `PrinterSettings.tsx` | reviewed; manual persistence pending | manual |
| FR-071 | Catalog recommendations/unknown fallback | `printerCatalog.generated.ts` | `printer-catalog.test.ts` | auto |
| FR-072 | Device differences in profiles | `printer.ts`, `compat.ts` | reviewed | review |
| FR-080 | IPC payload validation | `ipc/validation.ts` | `ipc-contract.test.ts` | auto |
| FR-081 | Script failure blocks submission | `printExecutor.ts`, `scriptRuntime.ts` | `print-executor.test.ts` | auto |
| FR-082 | Temp command/serial cleanup | `commandTransport.ts` | reviewed; file cleanup asserted in transport tests | partial |

## ESC/POS Extension

ESC/POS is implemented as feature `004-escpos` and reuses FR-001–FR-006, FR-010–FR-012,
FR-022–FR-024, FR-030–FR-033, FR-050–FR-054, FR-060–FR-063, FR-080–FR-082 through the
same scene/plan/transport contracts. Its protocol-specific requirements live in
`specs/004-escpos/spec.md`.

## Follow-ups

Remaining non-`auto` rows:

- FR-011: driver payload cap branch is reviewed, not directly asserted.
- FR-030: file/Bluetooth transports are covered indirectly (executor/file, missing COM);
  direct Bluetooth success is hardware/OS dependent.
- FR-023: preamble/postamble across multiple native batches is reviewed; add a direct
  assertion if batch framing changes.
- FR-061: on-disk JSONL write is reviewed; the executor log payload is asserted.
- FR-070/FR-072: settings persistence and profile-driven behavior need the manual matrix.
- FR-082: temp-file cleanup is reviewed; transport tests use mocked fs.

Manual-only: T009 driver print, T015 TSPL/ZPL/CPCL devices, T018 25-label batch,
T023 fallback/RFID, T026 disconnect/cancel, T029 settings persistence.

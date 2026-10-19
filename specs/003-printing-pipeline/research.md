# Research: Printing Pipeline and Devices (As-Is)

**Feature**: `003-printing-pipeline` | **Date**: 2026-10-18

The decisions below are already embodied in the implementation and the new tests. They
are recorded here with evidence; product questions are listed separately rather than
answered by assumption.

## D-001: One resolved scene for every output path

- **Decision**: `resolvePrintScene` produces `ResolvedPrintScene`; driver, TSPL, ZPL and
  CPCL consume it. Adapters do not resolve data sources or recompute physical geometry.
- **Rationale**: Preview, driver and native output must agree on text, serial values,
  visibility and label indices. Re-resolving would duplicate stateful logic.
- **Alternatives considered**: Per-adapter resolution (rejected: preview/print drift);
  adapter-specific geometry (rejected: two sources of truth).
- **Evidence**: `app/src/shared/print/scene.ts`, `engine.ts`,
  `tests/unit/shared/print/scene.test.ts`.

## D-002: PrintPlan is the single source of truth for quantity and order

- **Decision**: `buildExecutablePrintPlan` owns requested count, copies, record start,
  slots, dedupe, limits and serial advancement; preview and printing share the plan.
- **Rationale**: Batch arithmetic and serial advancement must not diverge between
  preview, driver and native paths.
- **Alternatives considered**: UI-side counting (rejected: duplicated rules);
  adapter-side copies (rejected: inconsistent logs/serials).
- **Evidence**: `app/src/shared/print/plan.ts`, `tests/unit/shared/print/plan.test.ts`.

## D-003: Native output is batched; file output is merged

- **Decision**: TCP/USB/COM/Bluetooth sends at most 24 pages per batch; file output
  merges all batches into one command file; preamble/postamble appear once.
- **Rationale**: Large jobs need bounded memory/transport payloads, while a command file
  must remain a single reproducible artifact.
- **Alternatives considered**: One giant payload (rejected: memory/transport limits);
  one file per batch (rejected: user expects one file).
- **Evidence**: `app/src/renderer/src/features/printing/printExecutor.ts`
  (`PRINT_BATCH_PAGES`), `tests/integration/renderer/print-executor.test.ts`.

## D-004: Rasterize when native commands cannot be faithful

- **Decision**: Unsupported rotation, complex text styling, fill/colour, ellipse or
  unknown barcode forces a monochrome page bitmap; if the bitmap is not ready, the send
  is blocked.
- **Rationale**: Partial output silently omitting objects is worse than a blocked task.
- **Alternatives considered**: Drop unsupported primitives (rejected); send approximate
  vectors (rejected: unmarked errors).
- **Evidence**: `app/src/shared/print/capabilities.ts`, `compat.ts`, `bitmap.ts`,
  `tests/e2e/render-harness.spec.ts`.

## D-005: Transport results are explicit

- **Decision**: Transport returns `accepted` / `failed` / `unknown` / `canceled`;
  multi-batch jobs use `partial` when earlier batches were confirmed; only confirmed
  labels advance serials and enter the log snapshot.
- **Rationale**: A closed socket or incomplete USB queue cannot prove the printer
  completed the job; treating it as success causes duplicate/missing labels.
- **Alternatives considered**: Boolean success (rejected: loses partial/unknown detail).
- **Evidence**: `app/src/shared/ipcContract.ts` (`PrintTransportStatus`),
  `app/src/main/printing/commandTransport.ts`,
  `tests/integration/main/printing-transport.test.ts`.

## D-006: Device differences live in printer config/catalog

- **Decision**: `PrinterConfig` stores command set, DPI, media, offsets and port;
  `printerCatalog.generated.ts` maps brand/model to recommended command sets; unknown
  brands use TSPL→ZPL→CPCL best effort.
- **Rationale**: Business components must not branch by brand; profiles are data.
- **Alternatives considered**: Brand conditionals in the executor (rejected: untestable
  and brittle).
- **Evidence**: `app/src/shared/domain/printer.ts`, `printerCatalog.generated.ts`,
  `tests/unit/shared/domain/printer-catalog.test.ts`.

## D-007: Encoding is explicit per port

- **Decision**: Native command payloads carry `encoding: 'utf8' | 'gbk'`; Chinese content
  uses iconv-lite encoding for GBK/GB18030.
- **Rationale**: Many label printers expect GBK; UTF-8 is the default for modern devices.
- **Alternatives considered**: Force UTF-8 (rejected: garbled Chinese on some devices).
- **Evidence**: `app/src/shared/ipcContract.ts`, `app/src/main/printing/commandTransport.ts`,
  `tests/contracts/protocol-golden.test.ts`.

## D-008: Protocol goldens are byte-exact

- **Decision**: TSPL/ZPL/CPCL fixtures are compared by byte length, SHA-256 and required
  tokens; `.gitattributes` marks them `-text`; generation goes through
  `npm run fixtures:print`.
- **Rationale**: Protocol output is binary text; line-ending conversion creates false
  failures and hides real byte changes.
- **Alternatives considered**: Text snapshots with normalization (rejected: masks bytes).
- **Evidence**: `app/fixtures/protocol/protocol-snapshots.json`,
  `tests/contracts/protocol-golden.test.ts`, `.gitattributes`.

## D-009: Driver payload and file size are bounded

- **Decision**: Driver payload is capped by `MAX_DRIVER_DATA_BYTES`; command files are
  capped at 64 MB / 100000 segments; print plans cap logical/copies/physical labels.
- **Rationale**: Prevents memory spikes, truncated files and runaway jobs.
- **Alternatives considered**: Unbounded batching (rejected: OOM/partial files).
- **Evidence**: `app/src/shared/print/limits.ts`, `plan.ts`, `printExecutor.ts`,
  `tests/integration/renderer/print-executor.test.ts`.

## D-010: Windows-first transports

- **Decision**: Driver/USB/LPT/COM/Bluetooth use Windows APIs/PowerShell; non-Windows
  platforms fail clearly where no adapter exists. TCP/file are platform-neutral.
- **Rationale**: The product targets Windows; supporting other platforms would require
  new transport adapters and verification.
- **Alternatives considered**: Cross-platform abstraction now (rejected: no target).
- **Evidence**: `app/src/main/printing/commandTransport.ts`.

## Open Questions

| ID | Question | Resolution (2026-10-18) |
|----|----------|--------------------------|
| Q-001 | 是否需要支持 ESC/POS？ | **Yes** — implement in `004-escpos` with full text/barcode/image/control/2D capability and a hardware matrix. |
| Q-002 | 中国邮政码是否走打印机内建条码？ | **Yes** — do not implement it ourselves; use printer built-in barcode. |
| Q-003 | 真机兼容矩阵需要覆盖多少品牌/固件？ | Keep the current vendor-doc matrix and sample key models before each release. |
| Q-004 | 是否需要跨平台传输适配器？ | **Yes** — `005-cross-platform`: macOS + Linux desktop builds + transports via native Node libraries. |
| Q-005 | 位图回退尺寸/内存上限是否提高？ | Keep current limits until real-device measurement; revisit later. |

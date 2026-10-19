# Implementation Plan: Printing Pipeline and Devices (As-Is)

**Branch**: `003-printing-pipeline` | **Date**: 2026-10-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-printing-pipeline/spec.md`

## Summary

This is an as-is domain baseline for the printing pipeline. It maps the 37 functional
requirements to the existing implementation and to the new test architecture, without
changing runtime behavior. The core invariant is that every output path consumes the same
`ResolvedPrintScene` / `PrintPlan`; driver printing, TSPL, ZPL and CPCL must not
re-resolve data sources or maintain a second geometry model.

The plan is documentation and verification work. Any defect found while reviewing the
mapping is recorded and fixed separately (FR-033 of the test-architecture feature).

## Technical Context

**Language/Version**: TypeScript 5.9.3; Node.js ≥ 22.12.0; package remains CommonJS

**Primary Dependencies**: Electron 44.3.0, Vitest 5.0.5, Playwright 1.64.1, esbuild
0.25.12 (harness bundling), iconv-lite, bwip-js, fabric

**Storage**: JSONL print log under Electron `userData`; temporary command/serial files;
Windows print spooler for driver/USB; optional command file for file-port output

**Testing**: Vitest unit/contract/integration plus Playwright E2E and renderer/workspace
harnesses. Current gate: 325 tests, 85.18% lines, 7 E2E specs.

**Target Platform**: Windows 10/11 x64. Real hardware verification is manual.

**Project Type**: Desktop application (Electron)

**Performance Goals**: Fast suite < 2 minutes; native batches at most 24 pages; driver
payload ≤ `MAX_DRIVER_DATA_BYTES`; command file ≤ 64 MB / 100000 segments; print limits
100000 logical labels, 99999 copies, 1000000 physical labels.

**Constraints**: Shared scene/plan; no adapter-level data resolution; byte-exact protocol
goldens; UTF-8/GBK encoding; bitmaps block sending when not ready; all privileged
transport goes through main-process IPC validation.

**Scale/Scope**: 3 native protocols, 8 port types, 6 user stories, 37 FR, 10 success
criteria.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status | Notes |
|-----------|------|--------|-------|
| I. 测试先行（TDD） | Behavior changes need failing tests first | PASS | This baseline changes no runtime behavior; the behavior is covered by unit/integration/E2E tests and harnesses. |
| II. 先澄清，不猜测 | Ambiguous scope must be clarified | PASS | Open hardware/ESC-POS questions are recorded in spec Baseline Notes and research. |
| III. 巨大架构变更先确认 | Architecture changes require explicit approval | N/A | Documentation/verification only; no architecture change. |
| Evidence rule | Every FR traces to code/tests | PASS | All 37 FR carry `Evidence:` references. |

**Post-design re-check**: unchanged. No product behavior is modified by this plan.

## Project Structure

### Documentation (this feature)

```text
specs/003-printing-pipeline/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── scene-plan.md
│   ├── protocol-output.md
│   ├── transport.md
│   └── printer-config.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
app/
├── src/
│   ├── shared/
│   │   ├── domain/              # document, objects, datasource, printer, paper
│   │   └── print/               # scene, plan, layout, engine, tspl, zpl, cpcl,
│   │                            # capabilities, compat, bitmap, limits, logSchema
│   ├── main/
│   │   ├── printing/            # commandTransport (TCP/COM/USB/Bluetooth/LPT/file)
│   │   ├── ipc/                 # registerPrintIpc, validation
│   │   └── previewWindow.ts
│   └── renderer/src/
│       ├── features/printing/   # executor, job, workflows, journal
│       ├── print/               # renderLabel, bitmapSource, imageValidation
│       └── dialogs/             # PrinterSettings, PrintDialog, PrintAdvancedDialog
├── tests/
│   ├── unit/shared/print/       # scene, plan, TSPL/ZPL/CPCL, device output
│   ├── contracts/               # protocol goldens
│   ├── integration/main/        # transport, barcode export
│   ├── integration/renderer/    # print executor
│   └── e2e/                     # print preview, render/workspace harnesses
└── fixtures/protocol/           # byte-exact goldens + manifest
```

**Structure Decision**: The printing domain is already isolated in `shared/print` and
`features/printing`; tests mirror the same boundaries. No new production module is
introduced by this baseline.

## Domain Decisions

1. **Single resolved scene** — `resolvePrintScene` expands groups, filters hidden/
   `suppressPrint` objects, resolves seven data-source kinds and freezes label/copy
   indices. Driver and native adapters consume the result.
2. **Single print plan** — `buildExecutablePrintPlan` owns counts, copies, record start,
   slots, deduplication, limits and serial advancement. Preview and printing share it.
3. **Batching** — native TCP/USB/COM/Bluetooth output is split at 24 pages; file output is
   merged into one job. Only confirmed batches advance serials and enter the log snapshot.
4. **Faithful fallback** — unsupported native features force page rasterization; if the
   bitmap is unavailable, sending is blocked rather than producing partial output.
5. **Explicit transport semantics** — `accepted`/`failed`/`unknown`/`canceled`, with
   partial batches recorded as `partial` and confirmed serial counts.
6. **Device differences in profiles** — printer catalog/brand recommendations and
   `PrinterConfig` carry device differences; business code does not branch by brand.
7. **Byte-exact goldens** — protocol output is validated by length, SHA-256 and required
   tokens; `.gitattributes -text` prevents CRLF drift.

## Verification

Automated:

```bash
cd app
npm run test:unit -- tests/unit/shared/print
npm run test:contracts -- tests/contracts/protocol-golden.test.ts
npm run test:integration -- tests/integration/main/printing-transport.test.ts tests/integration/renderer/print-executor.test.ts
npm run test:e2e -- tests/e2e/print-preview.spec.ts tests/e2e/render-harness.spec.ts
npm test
npm run test:coverage
```

Manual hardware checklist (not automated):

- Zebra (ZPL), TSC/佳博/汉印/芯烨/得力/启锐 (TSPL), CPCL device: print a 60×40 mm
  label with text, Code128, QR and an image; verify scan/print quality.
- Driver printer: verify one job with count × copies and correct page order.
- USB queue: verify confirmed vs incomplete completion handling.
- TCP/COM/Bluetooth: verify disconnected-device status is `unknown`/`failed`.
- RFID device: verify EPC write and lock (firmware-dependent).
- Paper out / ribbon out / cover open: verify the task does not report success.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Real-device behavior differs from protocol mocks | Manual matrix; record firmware/model; keep `unknown` rather than assuming success |
| Protocol output drifts without goldens | Byte-exact goldens + generator; review diffs before commit |
| CRLF corrupts protocol fixtures | `.gitattributes -text`; `fixtures:print` regeneration |
| Bitmap fallback silently missing | Block send when `pageBitmap` is not ready |
| Partial batch double-counts serials | Advance only confirmed batches; log `sentCount` |
| Driver payload too large | Reject above `MAX_DRIVER_DATA_BYTES`; suggest fewer pages/lower DPI |
| Windows-only transports | Clear failure on other platforms; document limitation |

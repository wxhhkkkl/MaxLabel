# Behavior → Test Index

**Feature**: `002-test-architecture` | **Date**: 2026-10-18

| Behavior | Test file | Layer |
|----------|-----------|-------|
| Units, DPI conversions, rounding | `unit/shared/units.test.ts` | unit |
| Table geometry / merges | `unit/shared/table.test.ts` | unit |
| Print scene resolution, filtering, auto-rotation | `unit/shared/print/scene.test.ts` | unit |
| Print plan counts, copies, slots, imposition | `unit/shared/print/plan.test.ts` | unit |
| TSPL output | `unit/shared/print/tspl.test.ts` | unit |
| ZPL output | `unit/shared/print/zpl.test.ts` | unit |
| CPCL output | `unit/shared/print/cpcl.test.ts` | unit |
| Device output: tables/ellipses/images/Chinese/RFID/fonts | `unit/shared/print/device-output.test.ts` | unit |
| ESC/POS builder: text/1D/raster/cut/drawer/QR/PDF417/DataMatrix | `unit/shared/print/escpos.test.ts` | unit |
| ESC/POS profiles and recommendations | `unit/shared/print/escposProfiles.test.ts` | unit |
| ESC/POS config normalization/round-trip | `unit/shared/domain/printer-escpos.test.ts` | unit |
| Data sources, serials, date/time, formatting | `unit/shared/domain/datasource.test.ts` | unit |
| Keyboard input order and saved-order merge | `unit/renderer/key-input-order.test.ts` | unit |
| Update version parsing and unavailable server | `unit/main/updater.test.ts` | unit |
| Script interpreter, sandbox, lifecycle, quotas, fuzz | `unit/shared/domain/scriptRuntime.test.ts` | unit |
| Document migration, normalization, redaction | `unit/shared/domain/document.test.ts` | unit |
| Barcode charsets and symbology options | `unit/shared/domain/barcode-charset.test.ts`, `barcode-spec.test.ts` | unit |
| Colour-change modes and native capability | `unit/shared/domain/color-change.test.ts` | unit |
| Printer catalog / label formats | `unit/shared/domain/printer-catalog.test.ts`, `label-formats.test.ts` | unit |
| Title / close guard / label spec | `unit/shared/appTitle.test.ts`, `close-guard.test.ts`, `label-spec.test.ts` | unit |
| Editor operations, groups, resize, availability | `unit/renderer/operations.test.ts` | unit |
| Fabric ↔ model geometry | `unit/renderer/editor-geometry.test.ts` | unit |
| Document undo/redo and serial rebasing | `unit/renderer/document-history.test.ts` | unit |
| Save queue, duplicate paths, close confirmation | `unit/renderer/documentPersistence.test.ts` | unit |
| Delimited text import / BOM / GB18030 | `unit/renderer/dataImport.test.ts` | unit |
| IPC channels, payload/port validation, sender | `contracts/ipc-contract.test.ts` | contracts |
| `.msdx` envelope, legacy JSON, redaction | `contracts/template-format.test.ts` | contracts |
| LabelShop `.lsdx` import | `contracts/lsdx-import.test.ts` | contracts |
| Protocol golden bytes/SHA/tokens | `contracts/protocol-golden.test.ts`, `contracts/escpos-golden.test.ts` | contracts |
| License activation/cache/offline | `integration/main/license.test.ts` | integration |
| Cloud offline + remote repository | `integration/main/cloud.test.ts` | integration |
| Template IPC and path capabilities | `integration/main/template-ipc.test.ts` | integration |
| Database connection strings + PowerShell bridge | `integration/main/db.test.ts` | integration |
| TCP/USB/serial/LPT transport | `integration/main/printing-transport.test.ts` | integration |
| Platform transport selection, enumeration, LPT unsupported | `unit/main/transport-adapter.test.ts` | unit |
| macOS/Linux build targets and native dependencies | `unit/main/build-targets.test.ts` | unit |
| Unix CUPS/serial/USB transports and ESC/POS via adapters | `integration/main/unix-transport.test.ts` | integration |
| Print executor driver/command/test/failure | `integration/renderer/print-executor.test.ts` | integration |
| Driver SVG allowlist and exact-one encoding | `contracts/driver-svg-validation.test.ts` | contracts |
| Driver HTML inline SVG, copies and CSP | `unit/main/driver-print-html.test.ts` | unit |
| Driver page paper clip composition | `unit/shared/print/driver-page-svg.test.ts` | unit |
| Vector pages, barcode SVG and raster fallback | `e2e/vector-render.spec.ts` | e2e |
| i18n translation, interpolation, fallback and missing-key reporting | `unit/shared/i18n/translate.test.ts` | unit |
| i18n catalog key/placeholder/help-section completeness | `unit/shared/i18n/completeness.test.ts` | unit |
| Renderer-wide lookup/dotted-key/raw-status coverage gate | `unit/shared/i18n/catalog-coverage.test.ts` | unit |
| Localized error catalog coverage for import/print/render | `unit/shared/i18n/error-coverage.test.ts` | unit |
| Language option normalization and OS detection | `unit/renderer/options-i18n.test.ts` | unit |
| Locale display formatting (dates/numbers) | `unit/renderer/i18n-format.test.ts` | unit |
| Localized IPC error keys and raw fallback | `contracts/i18n-ipc-errors.test.ts` | contracts |
| Localized IPC error resolution in the print executor | `integration/renderer/i18n-errors.test.ts` | integration |
| English core flow, HelpDialog, persistence and layout | `e2e/i18n.spec.ts` | e2e |
| First-launch OS language and English print preview | `e2e/i18n.spec.ts` | e2e |
| ESC/POS executor pipeline/log/serial | `integration/renderer/print-executor-escpos.test.ts` | integration |
| Electronic scale protocol parsing, stability and units | `unit/shared/scale/parse.test.ts`, `unit/shared/scale/units.test.ts` | unit |
| Scale configuration normalization (port/protocol/baud/unit/decimals) | `unit/shared/domain/document-scale.test.ts` | unit |
| Per-label scale value resolution and keyboard fallback | `unit/shared/scale/resolve.test.ts` | unit |
| Auto-print loop: one label per stable reading, stop cancels the read | `unit/renderer/scale/auto-print.test.ts` | unit |
| Weigh source defaults match the displayed serial settings | `unit/renderer/scale/config.test.ts` | unit |
| Scale connection diagnostics (bounded, sanitized raw frames) | `unit/renderer/scale/diagnostics.test.ts` | unit |
| Tab close cancels the print/scale operation that tab started | `unit/renderer/operation-tracking.test.ts` | unit |
| Scale IPC payload validation | `contracts/scale-ipc.test.ts` | contracts |
| Scale read/test/cancel lifecycle, timeout, busy and port release | `integration/main/scale.test.ts` | integration |
| Scale readings in the print executor (per label, no reuse, failure safety) | `integration/renderer/scale-print.test.ts` | integration |
| Simulated scale preview, disconnect error and auto-print control | `e2e/scale.spec.ts` | e2e |
| DB refresh cancellation and field rename | `integration/renderer/data-management.test.ts` | integration |
| Launch and create a label | `e2e/app-launch.spec.ts` | e2e |
| Open/save template roundtrip | `e2e/template-roundtrip.spec.ts` | e2e |
| Print preview | `e2e/print-preview.spec.ts` | e2e |
| Offline license editing/saving | `e2e/offline-license.spec.ts` | e2e |
| Electron launch/teardown probe | `e2e/spike.spec.ts` | e2e |
| Pixel parity, paper shapes, bitmap cache | `e2e/render-harness.spec.ts` | e2e |
| Workspace rulers, fit, zoom, clipping | `e2e/workspace-harness.spec.ts` | e2e |

All legacy P1 assertions are ported; the legacy suite was removed on 2026-10-18. See
`LEGACY-ASSERTIONS.md` for the mapping.

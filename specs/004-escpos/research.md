# Research: ESC/POS Command Support

**Feature**: `004-escpos` | **Date**: 2026-10-19

## D-001: A pure ESC/POS builder in `shared/print`

- **Decision**: Implement `app/src/shared/print/escpos.ts` as a pure command builder,
  similar to `tspl.ts`/`zpl.ts`/`cpcl.ts`.
- **Rationale**: Keeps command generation platform-independent and testable in Node;
  reuses the unified scene/plan pipeline.
- **Alternatives considered**: UI-side generation (rejected: duplicates pipeline);
  main-process generation (rejected: harder to unit test).
- **Evidence**: `app/src/shared/print/engine.ts`, `tspl.ts`, `zpl.ts`, `cpcl.ts`.

## D-002: Cover the core ESC/POS command families

- **Decision**: Support initialization (`ESC @`), alignment (`ESC a`), text size
  (`GS !`), bold (`ESC E`), underline (`ESC -`), reverse (`GS B`), line spacing
  (`ESC 3`/`ESC 2`), feed (`ESC d`), code page (`ESC t`), 1D barcode (`GS k`), raster
  (`GS v 0`), cut (`GS V`) and cash drawer (`ESC p`). QR/PDF417/DataMatrix use the
  `GS ( k` 2D family when the profile supports it.
- **Rationale**: These cover the agreed text/barcode/image/control scope without
  inventing receipt-formatting features.
- **Alternatives considered**: Minimal text-only support (rejected: fails agreed scope);
  full receipt layout (out of scope).
- **Evidence**: `specs/004-escpos/spec.md` user stories 1–3.

## D-003: Capability profiles gate native features

- **Decision**: An `EscPosProfile` describes paper width, DPI, printable dots, code page
  support, 1D/2D support, cut and drawer support. Unknown models use a conservative
  default.
- **Rationale**: ESC/POS is not strictly standardized; firmware differences cause silent
  wrong output.
- **Alternatives considered**: Assume all commands are supported (rejected: silent
  failures); branch by brand in the builder (rejected: untestable).
- **Evidence**: `app/src/shared/print/capabilities.ts`, `compat.ts`.

## D-004: Explicit code pages; rasterize when text cannot be represented

- **Decision**: Text uses the profile's code page (`ESC t`); when the label contains
  characters the code page cannot represent (e.g., Chinese without a CJK page), the page
  falls back to a monochrome bitmap.
- **Rationale**: Mojibake is worse than a slower, faithful raster.
- **Alternatives considered**: Force UTF-8 bytes (rejected: many devices ignore them);
  transliterate (rejected: data loss).
- **Evidence**: `app/src/shared/print/bitmap.ts`, `capabilities.ts`; 003 D-004/D-007.

## D-005: Paper width and DPI are profile/config facts

- **Decision**: Support 58 mm and 80 mm paper, 203/300 dpi, and their printable dot
  widths. Raster and barcode widths are validated against the profile.
- **Rationale**: 58 mm devices have ~384 dots at 203 dpi; overflow causes clipped output.
- **Alternatives considered**: One universal width (rejected: clipping); UI-only width
  (rejected: cannot validate).
- **Evidence**: `app/src/shared/domain/printer.ts`, `limits.ts`.

## D-006: Control commands are configuration, not content

- **Decision**: Cut mode (full/partial), cash-drawer pin (2/5), feed and initialization
  are `PrinterConfig` fields, emitted after content. Unsupported controls warn and do not
  abort content.
- **Rationale**: Devices differ; a missing cutter should not prevent the label from
  printing.
- **Alternatives considered**: Hard-code cut/drawer (rejected: device-specific); fail the
  job (rejected: loses the label).
- **Evidence**: `app/src/renderer/src/dialogs/PrinterSettings.tsx`,
  `app/src/shared/print/engine.ts`.

## D-007: Reuse the 003 pipeline and transport

- **Decision**: ESC/POS consumes `ResolvedPrintScene`/`PrintPlan` and returns the same
  `CommandPayload`/`PrintTransportResult`; no transport change in 004.
- **Rationale**: Counts, copies, serials, logs, cancel and statuses must stay identical.
- **Alternatives considered**: A separate ESC/POS executor (rejected: duplicate logic).
- **Evidence**: `specs/003-printing-pipeline/contracts/scene-plan.md`,
  `contracts/transport.md`.

## D-008: Byte-exact golden output

- **Decision**: Add one ESC/POS golden fixture and manifest entry; extend
  `generate-protocol-fixtures.ts` and regenerate rather than hand-edit bytes.
- **Rationale**: Text/binary command output must not drift unnoticed.
- **Alternatives considered**: Token-only assertions (rejected: misses byte changes).
- **Evidence**: `app/fixtures/protocol/protocol-snapshots.json`,
  `app/scripts/generate-protocol-fixtures.ts`.

## D-009: Native 2D barcodes are profile-gated

- **Decision**: QR/PDF417/DataMatrix use native `GS ( k` commands only when the profile
  declares support; otherwise the page/object is rasterized.
- **Rationale**: 2D native support varies widely by firmware; raster fallback is
  universally faithful.
- **Alternatives considered**: Always native (rejected: silent failures); always raster
  (rejected: loses scannability/performance on capable devices).
- **Evidence**: `app/src/shared/print/capabilities.ts`, `barcode.ts`.

## D-010: No new runtime dependency

- **Decision**: Use existing iconv-lite/bwip-js/bitmap utilities; do not add an ESC/POS
  library.
- **Rationale**: The command set is small, and a dependency would add another abstraction
  over the shared pipeline.
- **Alternatives considered**: A third-party ESC/POS library (rejected: less control over
  profiles/fallback).
- **Evidence**: `app/package.json`, `app/src/shared/print/*`.

## Verification (2026-10-19)

- Builder tests: `app/tests/unit/shared/print/escpos.test.ts` covers init/text/1D/raster/
  cut/drawer/QR/PDF417/DataMatrix/RFID rejection.
- Profile tests: `escposProfiles.test.ts` covers generic/known/unknown and recommendations.
- Config tests: `printer-escpos.test.ts` covers normalization, invalid defaults and
  template round-trip.
- Golden: `escpos-80x60-203dpi.prn` (221 bytes) is byte/hash/token checked.
- Executor: `print-executor-escpos.test.ts` proves ESC/POS uses the shared plan/log/
  serial/test-print semantics.
- Full gate: 350 tests / 42 files, 85.82% lines, 7 E2E specs.
- Architecture: `escpos.ts` consumes `ResolvedPrintScene`; `engine.ts` only dispatches;
  no transport/scene/plan changes were made.

## Open Questions

| ID | Question | Default |
|----|----------|---------|
| Q-001 | Which exact Epson-compatible models/firmware are in the release matrix? | Record in `verification/hardware-matrix.md`; start with Epson TM-T88/82, Xprinter, Gprinter. |
| Q-002 | Which code pages are required for Chinese? | Profile-specific CJK page if available; otherwise raster. |
| Q-003 | Default cash-drawer pin? | Pin 2 (`ESC p 0`); configurable. |
| Q-004 | Default cut mode? | Full cut (`GS V 0`); configurable. |
| Q-005 | Do all target devices support native QR? | Profile-gated; unknown = raster fallback. |
| Q-006 | 300 dpi 58/80 mm printable widths? | Derive per profile; validate in tests. |
| Q-007 | How should RFID objects behave on ESC/POS? | Reject the job with a clear error; ESC/POS cannot perform RFID writes. |

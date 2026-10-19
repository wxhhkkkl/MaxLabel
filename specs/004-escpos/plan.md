# Implementation Plan: ESC/POS Command Support

**Branch**: `004-escpos` | **Date**: 2026-10-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-escpos/spec.md`

## Summary

Add ESC/POS as a fourth native command set in the existing printing pipeline. The work
adds a pure command builder, capability profiles, printer configuration/UI and tests. It
does not duplicate scene resolution, print planning or transport: ESC/POS consumes the
same `ResolvedPrintScene` / `PrintPlan` and returns the same `CommandPayload` consumed by
the 003 transport layer.

Delivery is test-first: command/config/fallback tests are written before the builder and
UI wiring. Hardware results are recorded in `verification/hardware-matrix.md`.

## Technical Context

**Language/Version**: TypeScript 5.9.3; Node.js ≥ 22.12.0; Electron 44.3.0 (CJS package)

**Primary Dependencies**: Vitest 5.0.5, Playwright 1.64.1, bwip-js, iconv-lite, fabric.
No new runtime dependency is required for ESC/POS command generation.

**Storage**: Existing JSONL print log and template persistence; ESC/POS config is stored in
the template's `PrinterConfig`.

**Testing**: Vitest unit/contract/integration; Playwright E2E for preview/executor paths;
manual hardware matrix for ESC/POS devices.

**Target Platform**: Windows first; macOS/Linux transport arrives with `005-cross-platform`.
Command generation is platform-independent.

**Project Type**: Desktop application (Electron)

**Performance Goals**: Fast suite stays under 2 minutes; raster width bounded by paper
profile; no second full-page render unless fallback requires it.

**Constraints**: Consume the shared scene/plan; no adapter-level data resolution; no
brand-specific branches in business code; 58/80 mm paper profiles; explicit code page;
bitmap fallback when native output cannot be faithful.

**Scale/Scope**: 6 user stories, 15 FR, 7 SC; one new command module, config/profile
extensions and tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status | Notes |
|-----------|------|--------|-------|
| I. 测试先行（TDD） | Tests written first and seen failing | PASS (plan) | Every phase starts with failing tests; the plan below orders tests before implementation. |
| II. 先澄清，不猜测 | Ambiguous scope clarified | PASS | Owner confirmed full ESC/POS scope, Chinese-Post decision and hardware matrix policy. |
| III. 巨大架构变更先确认 | Architecture-level changes approved | PASS | Owner approved ESC/POS as feature 004; transport is owned by 005. |
| Evidence rule | Claims trace to code/tests | PASS | This plan cites existing pipeline modules and the 003 contracts. |

**Post-design re-check**: unchanged. ESC/POS extends `CommandSet` and the command builder;
it does not change scene/plan/transport semantics.

## Project Structure

### Documentation (this feature)

```text
specs/004-escpos/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── escpos-output.md
│   └── config-profile.md
├── verification/
│   └── hardware-matrix.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
app/src/
├── shared/
│   ├── domain/printer.ts          # CommandSet + ESC/POS config fields
│   └── print/
│       ├── escpos.ts              # NEW pure ESC/POS command builder
│       ├── engine.ts              # dispatch to escpos builder
│       ├── capabilities.ts        # rasterization/profile decisions
│       ├── compat.ts              # profile/recommendation mapping
│       └── limits.ts              # raster/width limits
├── main/ipc/validation.ts         # command set/config validation
└── renderer/src/
    ├── dialogs/PrinterSettings.tsx
    └── features/shell/installedPrinters.ts / printer catalog UI

app/tests/
├── unit/shared/print/escpos.test.ts
├── unit/shared/domain/printer-escpos.test.ts
├── contracts/escpos-golden.test.ts
├── integration/renderer/print-executor-escpos.test.ts
└── integration/main/printing-transport.test.ts (shared)
```

**Structure Decision**: A pure `escpos.ts` builder mirrors `tspl.ts`/`zpl.ts`/`cpcl.ts`.
Configuration/profile changes stay in the shared domain; UI only selects values. No
second print workflow is introduced.

## Implementation Phases

1. **Tests first (red)**
   - Add failing unit tests for `escpos` in `CommandSet` and config validation.
   - Add builder contract tests: init, text/styles, 1D barcode, raster, cut/drawer,
     alignment, code page and 2D fallback.
   - Extend the protocol golden manifest/generator with an ESC/POS fixture; test fails
     until the builder produces bytes.
2. **Core builder**
   - Implement `escpos.ts`: `ESC @`, text/style/alignment/line spacing, `GS k` 1D,
     `GS v 0` raster, `GS V` cut, `ESC p` cash drawer, feed.
   - Enforce paper-width/printable-dots and raster size limits.
3. **2D and fallback**
   - QR via `GS ( k` when the profile supports it; PDF417/DataMatrix native or
     page/object raster fallback.
   - Conservative default profile for unknown models; unsupported control commands warn
     and continue.
4. **Configuration and UI**
   - Add ESC/POS fields: paper width, DPI, code page, cut mode, cash-drawer pin, profile.
   - Add ESC/POS to the command-set selector and printer recommendation mapping without
     hand-editing generated catalog data.
   - Validate fields at IPC/persistence boundaries.
5. **Pipeline integration**
   - Wire `engine.ts`/`printExecutor.ts`; ensure counts/copies/serials/log/cancel are
     unchanged from 003.
   - Add executor/integration tests with TCP/file payloads.
6. **Hardware and docs**
   - Fill `verification/hardware-matrix.md` with models/firmware/paper/code-page results.
   - Update `tests/INDEX.md`, `tests/README.md` and the 003 FR matrix for ESC/POS.

## Key Decisions

1. **Pure builder** — ESC/POS generation is a pure function of resolved scene/plan and
   printer config; no Electron/DOM access.
2. **Profiles over brand branches** — `EscPosProfile` gates paper width, code page,
   1D/2D native support, cut/drawer. Unknown models use a conservative default.
3. **Raster fallback** — unsupported 2D/rotation/style/colour uses the existing page
   bitmap path; missing bitmap blocks sending.
4. **Code page explicit** — text is encoded with the profile's code page; if Chinese is
   not representable, rasterize rather than emit mojibake.
5. **Reuse transport** — no transport changes in 004; the command payload is sent by the
   existing adapters. Cross-platform adapters are 005.
6. **Golden output** — add one ESC/POS byte-exact fixture and manifest entry; update the
   generator, not hand-edit goldens.
7. **No new runtime dependency** — command generation uses existing iconv/bwip/bitmap
   utilities.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| ESC/POS firmware variance (2D, cut, drawer) | Profile-gated commands; conservative default; hardware matrix |
| Code page missing Chinese | Raster fallback; explicit code-page config |
| 58 mm printable width overflow | Profile width + raster validation; block/reject |
| Duplicate pipeline logic | Builder consumes `ResolvedPrintScene`/`PrintPlan`; architecture test |
| Golden drift | Byte-exact fixture + generator; review diff |
| Cut/drawer unsupported | Warn and continue content; record in matrix |
| Cross-platform transport not ready | 004 verified on Windows; 005 provides adapters |

## Verification

```bash
cd app
npx vitest run --project unit tests/unit/shared/print/escpos.test.ts tests/unit/shared/domain/printer-escpos.test.ts
npx vitest run --project contracts tests/contracts/escpos-golden.test.ts
npx vitest run --project integration tests/integration/renderer/print-executor-escpos.test.ts
npm test
npm run test:coverage
npm run test:e2e
```

Manual: complete `specs/004-escpos/verification/hardware-matrix.md` for 58 mm and 80 mm
Epson-compatible devices, covering text/styles, 1D, QR/PDF417/DataMatrix, image, cut,
drawer, code pages and fallback.

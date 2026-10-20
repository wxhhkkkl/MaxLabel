# Implementation Plan: Object Colour Change and Colour Index Table (As-Is)

**Branch**: `011-object-color-change` | **Date**: 2026-10-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-object-color-change/spec.md`

**Note**: Brownfield **as-is** baseline. The plan closes documentation and test gaps around
shipped colour-change behaviour; it does not add a new colour feature.

## Summary

Document and verify the existing dynamic-colour system: seven colour modes (fixed, random,
content index, index variable, colour-value variable, colour index, RGB values), four
granularities constrained by object type, shared/private colour-index tables with the ten
predefined colours, deterministic random selection, and one resolution function consumed by
the editor preview, raster rendering and native-command fallback. Runtime behaviour stays
unchanged except where a test proves the documented rule is not met (notably native
rasterisation for dynamic barcodes).

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Electron 44.3.0, Fabric.js

**Primary Dependencies**: No new runtime dependency. Existing `shared/domain/objects.ts`
colour resolver, `shared/domain/document.ts` normalisation, `ObjectPropsDialog`, Fabric
rendering and the print capability/rasterisation path.

**Storage**: `LabelObject.colorChange` on each object and `LabelDoc.colorIndexTable` for the
shared table, both persisted in `.msdx` templates. Defaults/migration are owned by
`normalizeDocument`; no template-version change.

**Testing**: Vitest (unit/contracts/integration) and Playwright Electron E2E. Existing
evidence: `tests/unit/shared/domain/color-change.test.ts` (modes, default table,
separators, granularity, image eligibility, character index, variables, block/gradient).
New tests are required before any code change; this plan adds coverage for normalisation,
renderer/native consistency and the property-page wiring.

**Target Platform**: Windows 10/11 x64 primary; macOS/Linux builds per `005-cross-platform`.

**Project Type**: Desktop application (Electron main/preload/renderer/shared).

**Performance Goals**: No product-level SLO. Colour resolution is per object/primitive and
must stay linear in characters/blocks; tables are capped at 256 entries and block grids at
100×100.

**Constraints**: One resolver (`resolveColorChangePlan`) for preview, bitmap and native
output; no new template fields; no change to `PrintPlan`/`ResolvedPrintScene` semantics;
dynamic colour must not produce wrong colour commands on native printers.

**Scale/Scope**: 7 modes, 4 granularities, 5 supported object types, 10 predefined colours,
tables ≤256 entries, block grids 1–100 per axis.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status | Notes |
|-----------|------|--------|-------|
| I. 测试先行（TDD） | New tests written and seen failing before code changes | **PASS** | Plan tasks start with failing tests for normalisation, resolver edge cases, renderer/native consistency and the property UI. |
| II. 先澄清，不猜测 | Ambiguities recorded, not guessed | **PASS (bounded)** | Open items stay `TODO(待确认)`: mono-image detection when unknown, whether the colour-table editor needs its own undo unit, and cross-version random stability. |
| III. 巨大架构变更先确认 | No architecture-level change | **PASS** | No new dependency/process/storage field. Colour resolution stays in `shared/domain/objects.ts`; print plan unchanged. |
| Single geometry/pipeline | One colour resolver, no duplicate rules | **PASS** | Preview, Fabric rendering, bitmap and native fallback must consume `resolveColorChangePlan`; tests import it directly. |
| Evidence rule | Every FR traces to code/tests | **PASS** | Each FR in `spec.md` carries `Evidence:`; this plan adds tests for rules that currently only have code evidence. |

**Post-design re-check**: unchanged; no violations, no complexity exceptions.

## Project Structure

### Documentation (this feature)

```text
specs/011-object-color-change/
├── plan.md              # This file
├── spec.md              # As-is specification
├── research.md          # Phase 0 decisions
├── data-model.md        # ColorChangeConfig/Plan, tables, validation
├── quickstart.md        # Validation scenarios
├── contracts/
│   ├── color-resolution.md
│   └── color-index-table.md
└── checklists/
    └── requirements.md
```

`tasks.md` is produced by `/speckit-tasks`.

### Source Code (repository root)

```text
app/src/shared/domain/
├── objects.ts            # modes, granularity, resolver, table/colour parsing
└── document.ts           # normalizeColorChange, colorIndexTable validation

app/src/shared/print/
└── capabilities.ts       # printerSupportsVariableColor + sceneNeedsRasterization

app/src/renderer/src/
├── dialogs/ObjectPropsDialog.tsx   # colour mode/table/granularity/block UI
├── rendering/fabricObjects.ts      # fills, barcode tint, image mono tint
└── print/renderLabelSvg.ts         # vector/raster page fallback

app/tests/
├── unit/shared/domain/color-change.test.ts   # existing evidence
├── unit/renderer/                            # new: normalisation/UI rules
├── integration/renderer/                     # new: native/vector colour fallback
└── e2e/                                      # new: colour property flow
```

**Structure Decision**: Keep all colour logic in the existing shared resolver and
document normaliser. No new module, package or persisted field is introduced.

## Phase 0 — Research

See [research.md](./research.md). Decisions:

- D-001: One resolver (`resolveColorChangePlan`) feeds preview, bitmap and native fallback.
- D-002: Mode/granularity matrix is fixed by object type (text/barcode/line/rect/ellipse/image).
- D-003: The predefined ten-colour table is the fallback for empty shared/private tables.
- D-004: Character index uses digits 0–9, letters `|code − 'A'| mod 10`, others `code mod 10`.
- D-005: Random colour is deterministic from label index, copy, record and position.
- D-006: Colour values split on commas/pipes; empty entries ignored; empty input falls back.
- D-007: Image colour is limited to datasource images or loaded mono bitmaps.
- D-008: Dynamic colour must force page rasterisation for native commands; the current
  `sceneNeedsRasterization` covers text/rect/ellipse and must be verified for barcodes.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md): `ColorChangeConfig`, `ColorChangePlan`, colour tables,
  normalisation/migration and resolution rules.
- [contracts/color-resolution.md](./contracts/color-resolution.md): resolver input/output,
  mode/granularity matrix, fallbacks, determinism and consumers.
- [contracts/color-index-table.md](./contracts/color-index-table.md): shared/private tables,
  parsing, defaults and validation.
- [quickstart.md](./quickstart.md): automated and manual validation scenarios.

## Complexity Tracking

No constitution violations; no complexity exceptions.

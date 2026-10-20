# Implementation Plan: Label Formats and Page Setup (As-Is)

**Branch**: `009-label-formats` | **Date**: 2026-10-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-label-formats/spec.md`

**Note**: This feature is a brownfield **as-is** baseline. The plan closes documentation and
test gaps around already-shipped behavior; it does not add a new label-format feature.

## Summary

Document and verify the existing label-format library and page-setup flow: a read-only
catalog of 275 LabelShop formats, media-type filtering (roll vs sheet), a three-level
brand/type/format picker, custom label geometry (size, grid, gaps, shape, hole, paper
colour), preview annotations, and the mapping of the selected format into `LabelDoc`.
The plan adds automated coverage for the currently untested UI/rules and keeps the
runtime behavior, template format, and print pipeline unchanged.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Electron 44.3.0, Fabric.js

**Primary Dependencies**: No new runtime dependency. Uses the frozen generated catalog
(`labelFormats.generated.ts`), shared paper geometry (`shared/domain/paper.ts`), the two
existing dialogs, and the existing i18n catalog.

**Storage**: Template document fields only — `widthMm`, `heightMm`, `formatKind`, and
`layout.{rows, cols, rowGapMm, colGapMm, shape, pageWidthMm, pageHeightMm, pagesPerBox,
cornerRadiusMm, innerDiameterMm, innerShape, labelColor}`. The selected format code is
**not** persisted; only its geometry and `formatKind` are. Saved in `.msdx` templates.

**Testing**: Vitest (unit/contracts/integration) and Playwright Electron E2E. Existing
evidence: `app/tests/unit/shared/domain/label-formats.test.ts`. New tests are required
before any behavior change; this plan adds tests for media-type rules, custom validation,
paper geometry, and preview annotation sizing.

**Target Platform**: Windows 10/11 x64 primary; macOS/Linux builds per `005-cross-platform`.

**Project Type**: Desktop application (Electron main/preload/renderer/shared).

**Performance Goals**: No product-level SLO. The catalog is a static 275-row module loaded
synchronously; preview rendering is local SVG and must stay responsive while typing.

**Constraints**: The catalog is generated and read-only (generator removed). Physical
geometry exists once in `shared/domain/paper.ts` + `paperHoleFields.ts`. No template format,
print-plan, or protocol change. No new dependency.

**Scale/Scope**: 275 formats / 2 brands / 17 categories; 2 dialogs (`NewLabelDialog`,
`CustomLabelFormatDialog`), 1 shared page-settings component (`PaperFields`), 1 preview
annotation helper.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status | Notes |
|-----------|------|--------|-------|
| I. 测试先行（TDD） | New tests are written and seen failing before any code change | **PASS** | Plan tasks start with failing tests for media rules, custom validation, paper geometry and annotations. Existing behavior that is already tested is not re-implemented. |
| II. 先澄清，不猜测 | Ambiguities resolved or explicitly marked | **PASS (bounded)** | The spec records three open items as `TODO(待确认)` (printer-tab placeholders, silent out-of-range rejection, disc mapping). This plan preserves them as-is and does not guess. Owner confirmation is required before changing any of them. |
| III. 巨大架构变更先确认 | No architecture-level change | **PASS** | No new process/service/dependency; no change to `LabelDoc` fields, `.msdx` format, `PrintPlan`, or IPC. Work is documentation + tests. |
| Single geometry / pipeline | No second geometry source | **PASS** | Page geometry stays in `shared/domain/paper.ts`; dialogs and print continue to consume it. |
| Evidence rule | Every FR traces to code/tests | **PASS** | Each FR in `spec.md` carries `Evidence:`; this plan adds tests for the FRs that currently only have code evidence. |

**Post-design re-check**: unchanged; no gate violations, no complexity exceptions.

## Project Structure

### Documentation (this feature)

```text
specs/009-label-formats/
├── plan.md              # This file
├── spec.md              # As-is specification
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities and validation rules
├── quickstart.md        # Validation scenarios
├── contracts/
│   ├── label-format-selection.md
│   └── page-geometry.md
└── checklists/
    └── requirements.md  # Spec quality checklist
```

`tasks.md` is produced by `/speckit-tasks`, not by this command.

### Source Code (repository root)

```text
app/src/
├── shared/domain/
│   ├── labelFormats.generated.ts   # frozen 275-row catalog
│   ├── paper.ts                    # shape/hole/colour geometry
│   └── document.ts                 # LabelDoc layout/formatKind validation
├── renderer/src/dialogs/
│   ├── NewLabelDialog.tsx          # media type, picker, preview, selection
│   ├── CustomLabelFormatDialog.tsx # custom geometry dialog (new-label path)
│   ├── TemplatePropsDialog.tsx     # edits an existing custom document; preset read-only
│   ├── PaperFields.tsx             # shared shape/hole settings
│   ├── paperHoleFields.ts          # hole options/semantics
│   └── previewAnnotation.ts        # annotation sizing
├── renderer/src/features/
│   └── workspace/labelSpec.ts      # status-bar spec summary
└── renderer/src/App.tsx            # handleNewFromDialog maps selection to LabelDoc

app/tests/
├── unit/shared/domain/label-formats.test.ts
├── unit/renderer/                  # new: media rules, custom validation, annotations
├── integration/renderer/           # new: selection → LabelDoc mapping (if needed)
└── e2e/                            # new: pick a format in the New Label dialog
```

**Structure Decision**: Keep all changes inside the existing renderer dialogs and shared
`paper.ts`/`document.ts`. No new module, package, process, or persisted field is introduced.

## Phase 0 — Research

See [research.md](./research.md). Decisions:

- D-001: Treat this feature as as-is verification + test-gap closure, not a redesign.
- D-002: The generated catalog is frozen and read-only; no regeneration tooling is added.
- D-003: Media type is derived from the selected printer (LabelShop printer → roll; Windows
  driver → sheet unless the name matches a known label-brand pattern); the picker resets
  brand/type/format when the media type changes.
- D-004: Page geometry is computed once in `shared/domain/paper.ts` and `paperHoleFields.ts`;
  dialogs, editor and print consume it.
- D-005: Preview annotation size uses a pixel-based ratio (0.12) clamped to 9–17 px,
  converted back to viewBox units.
- D-006: `formatCode` is selection-only; `LabelDoc` persists `formatKind` and geometry.
- D-007: Preserve the current silent out-of-range rejection and printer-tab placeholders;
  changing them requires owner clarification.
- D-008: “标签格式设置” opens the New Label dialog and creates a new document; editing an
  existing document uses “模板属性设置”, where preset (`formatKind = 'preset'`) geometry is
  read-only and custom geometry is editable.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md): `LabelFormatRecord`, `LabelFormatSelection`,
  `CustomLabelDraft`, `PaperGeometry`, `LabelDoc` layout fields, validation and mapping.
- [contracts/label-format-selection.md](./contracts/label-format-selection.md): selection
  payload, media rules, fallbacks, mapping into the document, non-persisted code.
- [contracts/page-geometry.md](./contracts/page-geometry.md): shapes, holes, colour,
  page-size fallbacks, annotation sizing, geometry ownership.
- [quickstart.md](./quickstart.md): automated and manual validation scenarios.

## Complexity Tracking

No constitution violations; no complexity exceptions. No table entries.

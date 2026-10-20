# Quickstart: Label Formats and Page Setup (As-Is)

**Feature**: `009-label-formats` | **Date**: 2026-10-20

## Prerequisites

- Windows 10/11 x64 (primary); Node.js ≥ 22.12.0; `npm install` completed.
- `app/` builds and the existing test gate passes.
- No printer is required for the picker/preview scenarios; the printer catalog can be empty.

## Automated validation

```bash
cd app
npm test
npm run test:coverage
env -u ELECTRON_RUN_AS_NODE npm run test:e2e
```

### Existing evidence

- `tests/unit/shared/domain/label-formats.test.ts`: 275 rows, 2 brands, 17 categories,
  default `608053` geometry, damaged names preserved.

### Planned coverage (write tests first, then change code only if a test fails)

| Behavior | Test file | Layer |
|----------|-----------|-------|
| Media type from printer selection/name | `tests/unit/renderer/label-formats-media.test.ts` | unit |
| Brand/category/format filtering and resets | `tests/unit/renderer/label-formats-media.test.ts` | unit |
| Custom format 5–500 mm / 1–100 validation | `tests/unit/renderer/custom-label-format.test.ts` | unit |
| Paper shape/hole geometry and limits | `tests/unit/shared/domain/paper.test.ts` | unit |
| Preview annotation font clamp | `tests/unit/renderer/preview-annotation.test.ts` | unit |
| Selection → `LabelDoc` mapping (formatKind, layout, no formatCode) | `tests/integration/renderer/new-label-mapping.test.ts` | integration |
| Template properties: preset read-only, custom editable, hole rehydration | `tests/unit/renderer/template-props-geometry.test.ts` | unit |
| New Label dialog picks a format and creates a document | `tests/e2e/new-label-format.spec.ts` | e2e |

If any planned test exposes a mismatch with the spec, fix the test or the code only after
confirming which one encodes the intended as-is behavior.

## Manual validation (no hardware required)

### V-01 Preset selection

1. Start `npm run dev`; open 文件 → 新建.
2. Select a sheet printer (or leave the default) and choose 京成云马 → a category → `608053`.
3. Confirm.

Expected: a 100×70 mm document with 2 columns × 4 rows, 2 mm gaps and a 210×297 mm page;
the status bar shows the label spec.

### V-02 Media switch

1. In the New Label dialog, switch between a roll printer (LabelShop/Gprinter/TSC) and a
   sheet printer.

Expected: the brand/category/format lists switch catalogs and reset to the first format of
the new media type; no format from the other media type remains visible.

### V-03 Custom format

1. Choose 自定义; enter width 80, height 50, rows 1, cols 2, gaps 0, shape 圆角矩形, hole 无.
2. Confirm; open 模板属性设置.

Expected: the document uses 80×50 mm, 2 columns, round rectangle, no hole; the template
properties dialog reopened with the same values and allows editing (`formatKind = custom`).

### V-04 Hole geometry

1. Choose shape 圆形, hole 矩形, size 6 mm on a 40×30 mm label.
2. Confirm and view the editor/preview.

Expected: a centered 6×6 mm square cutout; the size cannot exceed 29.98 mm.

### V-05 Annotation readability

1. Preview a 20×10 mm format and a 100×70 mm format.

Expected: sequence numbers and dimension labels remain readable (9–17 px rendered) and the
dimension line does not overlap the label edge.

### V-06 Out-of-range custom size (current behavior)

1. Enter width 4 mm or 501 mm and click 确定.

Expected (as-is): the dialog stays open and no format is created; no inline error is shown.
This is a known `TODO(待确认)` item, not an approved behavior change.

### V-07 Entry points and preset read-only

1. With a document open, choose 标签格式设置 from the File or context menu.
2. Then open 模板属性设置.
3. Create a document from preset `608053` and open 模板属性设置 again.

Expected: 标签格式设置 opens the New Label dialog and does not modify the current document;
模板属性设置 shows the current custom geometry as editable; the preset document’s page,
label, shape and hole fields are read-only.

## Validation record (2026-10-20)

| Gate | Command | Result |
|------|---------|--------|
| Baseline before changes | `env -u ELECTRON_RUN_AS_NODE npm test` | 69 files / 485 tests PASS |
| Typecheck (node/web/test) + Vitest | `env -u ELECTRON_RUN_AS_NODE npm test` | 78 files / 522 tests PASS |
| Coverage (`shared/domain` + `shared/print`, 80% lines) | `npm run test:coverage` | PASS — 86.88% lines |
| Playwright Electron E2E | `env -u ELECTRON_RUN_AS_NODE npx playwright test` | 23 passed |

Scenario evidence:

| Scenario | Evidence | Result |
|----------|----------|--------|
| V-01 preset selection (608053) | `e2e/new-label-format.spec.ts`, `integration/renderer/new-label-mapping.test.ts` | PASS |
| V-02 roll/sheet media switch | `unit/renderer/label-formats-media.test.ts`, `label-formats-catalog.test.ts` | PASS (function-level; printer switching is not driven in E2E) |
| V-03 custom 80×50, 1×2, round rectangle | `e2e/custom-label-format.spec.ts` | PASS |
| V-04 hole geometry and rectangle rehydration | `unit/shared/domain/paper.test.ts`, `e2e/custom-label-format.spec.ts` | PASS |
| V-05 annotation readability (9–17 px) | `unit/renderer/preview-annotation.test.ts`, `e2e/new-label-format.spec.ts` | PASS |
| V-06 out-of-range custom size and grid clamping | `unit/renderer/custom-label-format.test.ts`, `e2e/custom-label-format.spec.ts` | PASS (dialog stays open for size < 5 mm; typed rows > 100 clamp to 100) |
| V-07 entry points and preset read-only | `e2e/template-props-geometry.spec.ts`, `unit/renderer/label-format-entry-points.test.ts` | PASS |

Not exercised: physical printers, paper/hole cutting, and real device output. The automated
scenarios use the UI, status bar and shared geometry only.

No additional as-is corrections were confirmed during implementation; the entry-point and
`formatCode` corrections were already applied while producing the spec/plan/tasks.

## Known boundaries (do not “fix” without owner confirmation)

- Printer/other tab controls are visual placeholders and do not persist.
- Out-of-range custom sizes fail silently.
- Disc formats are inferred from `corner = 2` and the name’s `Wmm/Hmm` hole text.

## Out of scope

- New catalog entries or catalog editing.
- Template-format changes (persisting `formatCode`, adding fields).
- Print-pipeline or protocol changes.

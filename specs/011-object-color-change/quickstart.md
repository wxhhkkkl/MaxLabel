# Quickstart: Object Colour Change and Colour Index Table (As-Is)

**Feature**: `011-object-color-change` | **Date**: 2026-10-20

## Prerequisites

- Windows 10/11 x64 primary; Node.js ≥ 22.12.0; `npm install` completed.
- No printer is required for resolver/UI scenarios; a driver and a native printer profile
  are used for the output checks.

## Automated validation

```bash
cd app
npm test
npm run test:coverage
env -u ELECTRON_RUN_AS_NODE npm run test:e2e
```

### Existing evidence

- `tests/unit/shared/domain/color-change.test.ts`: seven modes, ten-colour default table,
  comma/pipe separators, granularity matrix, image eligibility, character index, index/value
  variables, block/gradient plans.
- Existing print tests cover vector barcode block/gradient fallback and raster pages.

### Planned coverage (tests first, then code only if a test exposes a defect)

| Behavior | Test file | Layer |
|----------|-----------|-------|
| Document normalisation/migration (legacy `variable`, bad granularity, table limits, 1–100 blocks) | `tests/unit/shared/domain/color-change-normalize.test.ts` | unit |
| Resolver fallbacks for empty content/variables/values and non-text object types | `tests/unit/shared/domain/color-change.test.ts` | unit |
| Native command raster trigger for dynamic-colour text/rect/ellipse **and barcode** | `tests/integration/renderer/color-native.test.ts` | integration |
| Vector page fallback for block/gradient barcodes | `tests/integration/renderer/color-vector.test.ts` | integration |
| Property dialog mode/table/granularity/block controls | `tests/e2e/color-change.spec.ts` | e2e |

If a planned test exposes a mismatch, decide which side encodes the intended as-is behaviour
before changing code.

## Manual validation

### V-01 Modes

1. Create a text object and set 颜色 to 随机颜色, 以数据源内容为索引, 颜色索引变量,
   颜色值变量, 颜色索引 and RGB颜色值 in turn.
2. Preview each configuration.

Expected: each mode changes the rendered colours; empty variables/inputs keep the object
colour; invalid content does not throw.

### V-02 Granularity

1. Text: 整体变色 vs 逐字符变色.
2. Barcode: 整体变色 vs 按区块变色 (2×3) vs 渐变变色.
3. Rectangle/ellipse/image: only 整体变色 is offered.

Expected: text colours per character; barcode colours per block with the configured grid;
unsupported granularities are not selectable.

### V-03 Colour index tables

1. Use the private table with no entries → indexes 0–9 use the predefined colours.
2. Add `#123456` at index 0, then switch to the shared table and edit it.
3. Confirm the preview uses the selected table and the document saves the shared table.

Expected: empty tables fall back to the ten colours; private/shared edits affect only their
scope; the shared table survives save/reopen.

### V-04 Variables and inputs

1. Keyboard variable `clr = 12` with 颜色索引变量 + 逐字符.
2. Variable `clr = #FF0000|#00FF00` with 颜色值变量.
3. `颜色索引` input `12`; `RGB颜色值` input `#FF0000,#00FF00` and `#FF0000 | #00FF00`.

Expected: `12` yields index 1 then index 2; both separators yield the same two colours;
empty values keep the object colour.

### V-05 Images

1. Use a datasource (mono) image and a loaded mono bitmap; enable variable colour.
2. Use an embedded colour image.

Expected: datasource/mono images can be tinted; colour images cannot, with the explanatory
hint.

### V-06 Output

1. Print a dynamic-colour text/rect with a Windows driver.
2. Print the same label through a native command port (TSPL/ZPL/CPCL), including a
   block/gradient barcode.

Expected: driver output keeps colour; native output falls back to the page bitmap and never
prints black native commands for a dynamic-colour primitive.

## Validation record (2026-10-20)

| Gate | Command | Result |
|------|---------|--------|
| Baseline before changes | `env -u ELECTRON_RUN_AS_NODE npm test` | 565 tests / 28 E2E PASS |
| Typecheck (node/web/test) + Vitest | `env -u ELECTRON_RUN_AS_NODE npm test` | 93 files / 595 tests PASS |
| Coverage (`shared/domain` + `shared/print`, 80% lines) | `npm run test:coverage` | PASS — 87.48% lines |
| Playwright Electron E2E | `env -u ELECTRON_RUN_AS_NODE npx playwright test` | 31 passed |

Scenario evidence:

| Scenario | Evidence | Result |
|----------|----------|--------|
| V-01 modes | `unit/shared/domain/color-change.test.ts`, `e2e/color-change.spec.ts` | PASS |
| V-02 granularity | `unit/shared/domain/color-change.test.ts`, `e2e/color-change.spec.ts` (barcode offers block/gradient) | PASS |
| V-03 shared/private tables | `unit/shared/domain/color-index-table.test.ts`, `e2e/color-change.spec.ts` | PASS |
| V-04 variables and inputs | `unit/shared/domain/color-change-variables.test.ts` | PASS (unit-level; property fields covered by E2E) |
| V-05 images | `unit/shared/domain/color-change.test.ts` (datasource/mono eligibility) | PASS (unit-level; colour-image hint not re-driven in E2E) |
| V-06 output | `integration/renderer/color-native.test.ts`, `color-line.test.ts`, `color-vector.test.ts` | PASS at the scene/capability level; no physical printer used |

Implementation notes:

- D-008: `sceneNeedsRasterization` now forces page rasterisation for dynamic-colour
  **barcodes** as well as text/rect/ellipse.
- T023: line objects now resolve their stroke through `resolveObjectColor`, and dynamic-colour
  lines are included in the native raster trigger.

Both fixes were driven by failing tests written first.

Not exercised: real colour printers, physical output, and OS printer-driver colour handling.

## Known boundaries (do not change without owner confirmation)

- Mono-image detection when the image is not loaded treats the image as unsupported
  (`TODO(待确认)`).
- Whether the colour-table editor should be its own undo unit (`TODO(待确认)`).
- Random-colour stability across application versions (`TODO(待确认)`).
- `sceneNeedsRasterization` currently triggers for text/rect/ellipse dynamic colour; the
  barcode case must be verified and fixed if it misses (D-008).

## Out of scope

- Adding colour modes, granularities or object types.
- Changing the predefined ten colours or the index formula.
- Changing the template format or print plan.

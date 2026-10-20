# Data Model: Label Formats and Page Setup (As-Is)

**Feature**: `009-label-formats` | **Date**: 2026-10-20

## LabelFormatRecord (catalog row)

Frozen runtime data from `app/src/shared/domain/labelFormats.generated.ts`.

| Field | Type | Rules / Meaning |
|-------|------|-----------------|
| `code` | string | 格式码；`608053` 为默认平张格式 |
| `brandId` / `brandName` | number / string | 品牌（当前 2 个：京成云马、普林泰科） |
| `categoryId` / `categoryName` / `categoryParentName` | number / string | 标签类型（当前 17 个分类） |
| `type` | number | 介质：`0` 卷筒，`1` 平张 |
| `name` | string | 显示名；光盘类名称含 `Wmm/Hmm` 中心孔 |
| `page` | number | 拼版页数 |
| `pageWidthMm` / `pageHeightMm` | number | 纸张尺寸 |
| `pageLeftMm` / `pageTopMm` | number | 标签阵列在纸张中的起点 |
| `labelWidthMm` / `labelHeightMm` | number | 单标签宽高 |
| `cols` / `rows` | number | 每页列数/行数 |
| `colGapMm` / `rowGapMm` | number | 列距/行距 |
| `corner` | number | `0` 方角，`1` 圆角，`2` 光盘（圆形 + 中心孔） |
| `orientation` | number | 目录自带的方向 |
| `layout` | string | 目录原始布局描述 |
| `totalLabels` | number | 平张格式的每盒标签数 |
| `coreMm` / `productName` / `productNote` | number / string | 产品元数据 |

Invariants (covered by `label-formats.test.ts`): 275 rows, brand IDs `[1, 2]`, 17 distinct
categories, default `608053` = 100×70 mm, 2×4, gaps 2 mm, page 210×297 mm.

## Media classification

| Input | Result |
|-------|--------|
| 签赋 LabelShop catalog printer | roll (`type = 0`) |
| Windows driver printer | sheet (`type = 1`) |
| Driver name matches `佳博/gprinter/gp-\d+/zebra/斑马/xprinter/芯烨/hprt/汉印/tsc/argox/立象/label` | roll |
| No explicit printer, non-driver port | roll |
| No explicit printer, driver port | name pattern decides, default sheet |

Switching media type resets `brandId`, `categoryId` and `formatCode` to the first format of
the new media type.

## LabelFormatSelection

Produced by `NewLabelDialog` and consumed by `App.handleNewFromDialog`.

| Field | Type | Persisted? | Notes |
|-------|------|------------|-------|
| `rows` / `cols` | number | yes (`layout`) | 1–100 |
| `rowGapMm` / `colGapMm` | number | yes (`layout`) | optional for presets |
| `pagesPerBox` | number | yes (`layout`) | only when the preset is sheet media (`totalLabels`) |
| `formatKind` | `'preset' \| 'custom'` | yes (`LabelDoc.formatKind`) | defaults to `custom` when absent |
| `formatCode` | string | **no** | selection-only; not stored in the template |
| `pageWidthMm` / `pageHeightMm` | number | yes (`layout`) | only when both are present |

## CustomLabelDraft

Input model of `CustomLabelFormatDialog`.

| Field | Type | Rules |
|-------|------|-------|
| `width` / `height` | string → number | 5–500 mm to confirm; invalid values block confirm |
| `rows` / `cols` | string → int | clamped to 1–100 |
| `rowGap` / `colGap` | string → number | ≥ 0 |
| `shape` | `rect \| roundRect \| ellipse` | UI options; `disc` is not exposed |
| `hole` | `none \| circle \| rectangle` | size box disabled for `none` |
| `holeSize` | string → number | clamped to 0..min(width, height) − 0.02 |
| `labelColor` | string | normalized to `#rrggbb`; invalid → `#ffffff` |
| `pageWidth` / `pageHeight` | string → number | > 0.1; empty/0 falls back to grid + 4 mm |

## PaperGeometry

Shared shape model in `shared/domain/paper.ts`.

| Field | Type | Rules |
|-------|------|-------|
| `shape` | `rect \| roundRect \| ellipse \| disc` | UI exposes rect/roundRect/ellipse; `disc` normalized to ellipse + hole |
| `cornerRadiusMm` | number? | roundRect uses fixed ≈1 mm unless an explicit radius is present |
| `innerDiameterMm` | number? | circle = diameter, rectangle = side; centered; ≤ min(w,h) − 0.02 |
| `innerShape` | `circle \| rectangle`? | absent = circle (legacy semantics) |
| `labelColor` | string? | `#rrggbb`; editor-only, never printed |

`paperPath(width, height, paper)` draws the label outline with the centered cutout using the
even-odd rule.

## LabelDoc mapping

`handleNewFromDialog` writes:

```text
widthMm, heightMm          <- selected/typed label size
formatKind                 <- format?.formatKind ?? 'custom'
layout.rows/cols           <- format ?? system defaults
layout.rowGapMm/colGapMm   <- format ?? system defaults
layout.shape               <- paper.shape ?? options.labelShape
layout.pageWidthMm/Height  <- format.pageWidthMm/pageHeightMm (when both present)
layout.pagesPerBox         <- format.pagesPerBox (when present)
layout.innerDiameterMm     <- paper.innerDiameterMm (when present)
layout.innerShape          <- paper.innerShape (when present)
layout.labelColor          <- paper.labelColor (when present)
```

Document normalization (`document.ts`) then enforces: label size 0.1–10000 mm; layout
rows/cols 1–100; page size 0.1–10000; `pagesPerBox` 1–100000; corner radius ≤ half the short
side; hole diameter ≤ short side − 0.02; `labelColor` only `#rrggbb`; `innerShape` only
circle/rectangle; `formatKind` only preset/custom.

`formatKind` also controls editability: `preset` documents expose page/label/shape/hole
fields as read-only in `TemplatePropsDialog`; `custom` documents allow editing. It does not
affect print geometry.

## Preview computation

For the picker preview (`NewLabelDialog`):

```text
pageW = max(format.pageWidthMm, labelWidthMm)
pageH = max(format.pageHeightMm, labelHeightMm) + rollStripExtra
originX = format.pageLeftMm || (pageW - gridW) / 2
originY = format.pageTopMm || (pageH - gridH) / 2
gridW = cols * labelWidthMm + (cols - 1) * colGapMm
gridH = rows * labelHeightMm + (rows - 1) * rowGapMm
rollStripExtra = 2 * (rowGapMm + round(labelHeightMm * 0.12))
```

Annotation font size = `clamp(labelHeightPx × 0.12, 9 px, 17 px) / previewScale`, where
`previewScale = min(boxW / viewW, boxH / viewH)`.

## Relationships

```text
LABEL_FORMATS (275) --filter type--> brand list --> category list --> format
format --mediaType + preset mapping--> LabelFormatSelection
LabelFormatSelection + CustomLabelDraft --paper geometry--> LabelDoc.layout
LabelDoc.layout --paper.ts--> editor outline / preview / print page
```

# Contract: Label Format Selection

**Feature**: `009-label-formats` | **Date**: 2026-10-20

## Producer / consumer

- **Producer**: `app/src/renderer/src/dialogs/NewLabelDialog.tsx`
- **Consumer**: `App.handleNewFromDialog` → `openDoc` → `normalizeDocument`
- **UI surfaces**: “新建标签” (File → New) and the format picker inside
  `CustomLabelFormatDialog` (custom path).

## Entry points

- “标签格式设置” (File/toolbar/context menu) opens **New Label** (`setModal('new')`) and
  creates a new document; it does not rewrite the current document.
- Editing an existing document’s page/label geometry uses “模板属性设置”
  (`TemplatePropsDialog` + `PaperFields`). When `formatKind = 'preset'`, page size, label
  size, grid, shape and hole fields are read-only; custom documents allow editing.
- The custom path in the New Label dialog seeds `customInitial` from the selected catalog
  record, not from the current document.

## Selection payload

```ts
interface LabelFormatSelection {
  rows: number
  cols: number
  rowGapMm?: number
  colGapMm?: number
  pagesPerBox?: number          // sheet media only: preset.totalLabels
  formatKind: 'preset' | 'custom'
  formatCode?: string           // selection-only; never persisted
  pageWidthMm?: number
  pageHeightMm?: number
}
```

`onSelect(widthMm, heightMm, paper?: PaperGeometry, printerName?: string, format?)`.

## Media rules

| Printer selection | Media | Catalog filter |
|-------------------|-------|----------------|
| 签赋 LabelShop printer | roll | `type === 0` |
| Windows driver printer | sheet | `type === 1` |
| Driver name matches label-brand pattern | roll | `type === 0` |
| No printer, non-driver port | roll | `type === 0` |
| No printer, driver port | name pattern, else sheet | `0` or `1` |

On media change, the dialog resets `brandId`, `categoryId`, `formatCode` to the first row of
the new media type. An unknown `formatCode` falls back to the first format of the selected
category, then to the default format, then to the first catalog row.

## Catalog query semantics

```text
available = LABEL_FORMATS.filter(f => f.type === mediaType)
brands    = distinct(available, brandId)
formats   = available.filter(f => f.brandId === brandId)
categories= distinct(formats, categoryId)
category  = formats.filter(f => f.categoryId === categoryId)
selected  = available.find(code) ?? category[0] ?? INITIAL
```

The brand/category/format lists preserve catalog order; no sorting is applied.

## Mapping to the document

| Selection | LabelDoc |
|-----------|----------|
| `widthMm`, `heightMm` | `widthMm`, `heightMm` |
| `rows`, `cols` | `layout.rows`, `layout.cols` |
| `rowGapMm`, `colGapMm` | `layout.rowGapMm`, `layout.colGapMm` |
| `pageWidthMm`, `pageHeightMm` | `layout.pageWidthMm`, `layout.pageHeightMm` (only when both exist) |
| `pagesPerBox` | `layout.pagesPerBox` |
| `paper.shape/cornerRadiusMm/innerDiameterMm/innerShape/labelColor` | same `layout` fields |
| `formatKind` | `formatKind` (`custom` when absent) |
| `formatCode` | **not copied** |

`normalizeDocument` is the final validator; values outside its ranges are rejected or
clamped as documented in `data-model.md`.

## Invariants

- The selected format’s `labelWidthMm/labelHeightMm` determine the label size in the
  document; the picker does not allow editing a preset’s size.
- A preset selection never mutates the catalog.
- Switching media type never leaves a brand/category/format from the other media type.
- The preview is derived only from the selected record and `PaperGeometry`; no document
  state is required to render it.

## Non-goals

- Persisting `formatCode` or re-opening the picker on a saved template’s original row.
- Editing the catalog or adding/removing formats.
- Changing the `.msdx` template format or adding fields.

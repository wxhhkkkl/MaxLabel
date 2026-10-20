# Contract: Object Creation and Property Geometry

**Feature**: `016-editor-canvas` | **Date:** 2026-10-20

## Factory

`createLabelObject(type, x, y, defaults)` is the only default source for new objects. It
returns `null` for unsupported types.

| Type | Default frame (mm) | Notable defaults |
|------|--------------------|------------------|
| text | 40 × 8 | 微软雅黑 4 pt, centered, constant "文字内容" |
| data | 44 × 8 | same text defaults, constant "数据字段" |
| barcode | 44 × 10 | Code128, show text, `xSizeMil 10`/`xSizeMm 0.254`, constant "1234567890" |
| RFID | 44 × 10 | EPC, serial `E2…`, 8 digits, no lock |
| rect | 40 × 8 | white fill (disabled), black stroke 0.3 |
| ellipse | 40 × 8 | white fill, black stroke 0.3 |
| table | 44 × 24 | 3×2, border 0.3; `keepSize` from `defaults.tableKeepSize` |
| line | 30 × 0 | black stroke 0.3 |
| diagonal | 30 × 8 | converted to a line object |
| image | 24 × 16 | embedded placeholder, fit, keep aspect |

## Property tabs

`propertyTabsFor(type)` defines the tab order:

| Type | Tabs |
|------|------|
| text | 数据源、字体、文本、常规 |
| barcode | 数据源、条码、字体、常规 |
| rfid | 通用、RFID、数据 |
| image | 图片、常规 |
| table | 表格、常规 |
| rect/ellipse/line | 图形、常规 |
| other | 常规 |

The tab set is data-driven; components render only the returned tabs.

## Geometry draft

`useObjectGeometryDraft(object, onPatch)`:

- Holds string drafts for `x`, `y`, `w`, `h`, `rotation`.
- `commit()` parses each value; non-finite input falls back to the object's current value.
- `w`/`h` are clamped to ≥ 0.1 mm.
- The dialog commits on “确定”; closing/cancel does not write the draft.

## Entry points

- Double-click an object → object properties dialog.
- Data tool click → “修改数据” dialog.
- Right-click → object context menu (copy/delete/order/properties, thresholds from
  `editorAvailability`).
- Alt+Enter opens properties for the current selection.

## Non-goals

- Changing default sizes/fonts or adding object types.
- Editing multiple objects at once from the property dialog.

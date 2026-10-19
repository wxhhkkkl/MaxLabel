# Contract: Scene and Print Plan

**Feature**: `003-printing-pipeline` | **Date**: 2026-10-18

## Inputs

- `LabelDoc`: document model (objects, datasets, layout, printer config, global script).
- `DataCtx`: label/record index, copy, count, total labels, fixed `now`, datasets,
  keyboard values, shared script variables, record row.

## Outputs

- `ResolvedPrintScene`: label size, label/copy index, primitives, paper geometry,
  imposed cells, colour table, optional page bitmap.
- `PrintPlan`: pages/cells with record index, logical label index, copies and slot; total
  logical/physical counts; serial advance count; warnings.

## Invariants

1. All output paths resolve the same scene and plan; adapters MUST NOT re-resolve data.
2. Hidden objects are excluded; `suppressPrint` is excluded by default and included only
   when requested.
3. Native output keeps only objects fully inside the label; preview keeps all objects.
4. The scene context retains only the current database row and column metadata.
5. Plan copies do not advance serials; serial advancement equals confirmed logical count.
6. Empty datasets produce zero pages and block printing.
7. `startSlot` leaves leading slots empty on the first page.
8. Deduplication preserves first-seen order and original row indices.
9. Limits: 100000 logical labels, 99999 copies, 1000000 physical labels.
10. Test print produces one logical and one physical label.

## Error Semantics

- Invalid counts/limits throw with a message naming the limit.
- Missing/empty dataset returns zero pages with a warning; the executor sets a blocking
  status.
- Script lifecycle failure throws before submission and leaves no partial publication.

Evidence: `app/src/shared/print/scene.ts`, `plan.ts`, `layout.ts`, `limits.ts`,
`tests/unit/shared/print/scene.test.ts`, `plan.test.ts`.

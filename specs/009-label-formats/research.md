# Research: Label Formats and Page Setup (As-Is)

**Feature**: `009-label-formats` | **Date**: 2026-10-20

## Scope and Method

This is a brownfield as-is feature. Research was limited to reading the existing
implementation, the generated catalog, and the existing test; no new product behavior was
invented. Open questions from the spec remain `TODO(待确认)` and are explicitly out of the
change scope until the owner decides.

## D-001: Verification-first, no redesign

- **Decision**: The feature is delivered as documentation + missing automated coverage.
  Production behavior changes only if a newly written test exposes a defect.
- **Rationale**: The spec documents shipped behavior; refactoring the picker or geometry
  would create regression risk without user value and would violate the "surgical changes"
  rule.
- **Alternatives considered**: Re-implementing the picker on a shared table component
  (rejected: no requirement, high regression surface); moving geometry into a new module
  (rejected: `shared/domain/paper.ts` is already the single source).

## D-002: Frozen generated catalog

- **Decision**: Treat `app/src/shared/domain/labelFormats.generated.ts` as read-only
  runtime data. Do not add a generator or an editing UI.
- **Rationale**: The file header states it was generated from `LabelFormat360.fmt`; the
  generator was removed with the parity material. The catalog is the runtime source of
  truth and has a golden unit test (275 rows, 2 brands, 17 categories).
- **Alternatives considered**: Re-adding a generator (rejected: source database is not in
  `main`; would add tooling and a dependency); shipping a JSON asset (rejected: no benefit,
  changes bundling and loading).

## D-003: Media type from the selected printer

- **Decision**: Keep the current rule set:
  - 签赋 LabelShop catalog printers → roll (`type = 0`).
  - Windows driver printers → sheet (`type = 1`), unless the driver name matches the
    known label-brand pattern (Gprinter/Zebra/Xprinter/HPRT/TSC/Argox/Label/SATO-like).
  - No explicit printer → use the saved printer config; non-driver ports → roll, driver
    ports → name heuristics.
- **Rationale**: Matches the recorded LabelShop behavior (`probe-09-roll-after-select`) and
  the existing code. The catalog is split by `type`; choosing the wrong media type would
  hide half the formats.
- **Alternatives considered**: A user-visible media-type selector (rejected: not in the
  as-is UI); always sheet (rejected: breaks roll-printer defaults).

## D-004: Single geometry source

- **Decision**: Shapes, holes, page fallbacks and label colour are computed in
  `shared/domain/paper.ts` + `dialogs/paperHoleFields.ts`, and consumed by both the new
  label dialog and the template settings dialog.
- **Rationale**: The constitution forbids a second physical-geometry implementation; the
  two dialogs previously drifted on annotation sizing and hole semantics.
- **Alternatives considered**: Per-dialog geometry (rejected: drift); moving the dialog
  helpers into `shared/` (rejected: they are UI option tables; `paper.ts` already owns the
  geometry).

## D-005: Preview annotation sizing

- **Decision**: Annotation font size = label height in rendered pixels × 0.12, clamped to
  9–17 px, then converted back to viewBox units. Holes and dimension lines use the same
  computed size.
- **Rationale**: The recorded defect was that viewBox units were used directly, making
  annotations ~4.8 px on small labels. Pixel-first sizing keeps them readable across label
  sizes and preview scales.
- **Alternatives considered**: Fixed viewBox size (rejected: the original defect); CSS
  scaling of a separate overlay (rejected: duplicates layout logic).

## D-006: Format code is selection-only

- **Decision**: `LabelFormatSelection` carries `formatCode` for the current selection, but
  `LabelDoc` persists only `formatKind` plus the geometry fields (`rows`, `cols`, gaps,
  page size, `pagesPerBox`, paper geometry).
- **Rationale**: This is the current behavior (`App.handleNewFromDialog` sets
  `formatKind`/layout and drops the code); persisting the code would change the template
  format and require a migration.
- **Alternatives considered**: Persist `formatCode` to restore the exact picker row later
  (rejected: template-format change; would need a new field + migration).

## D-007: Preserve known boundaries pending owner input

- **Decision**: Do not change the silent rejection of out-of-range custom sizes, the
  visual-only printer/other tabs, or the `corner = 2` disc mapping. They stay documented
  as `TODO(待确认)` in the spec.
- **Rationale**: Each would change user-visible behavior or the interpretation of existing
  templates, and the spec does not authorize a change.
- **Alternatives considered**: Adding inline validation errors (deferred: needs UX
  decision); wiring the printer-tab controls (deferred: needs persistence and print
  behavior design); introducing a `disc` shape enum (deferred: template migration).

## D-008: Two distinct entry points

- **Decision**: Keep “标签格式设置” as the New Label dialog (creates a new document) and use
  “模板属性设置” to edit an existing document’s page/label geometry. Preset documents
  (`formatKind = 'preset'`) render the page/label/shape/hole fields read-only; custom
  documents allow editing.
- **Rationale**: This matches the current menu wiring (`setModal('new')`) and
  `TemplatePropsDialog` (`pageEditable/labelEditable = !isPreset`). Treating the two as one
  dialog would either rewrite an existing document unexpectedly or make presets editable,
  both behavior changes.
- **Alternatives considered**: Reusing the custom-format dialog for the current document
  (rejected: changes the meaning of a menu command and risks accidental page reconfiguration);
  allowing preset edits (rejected: contradicts LabelShop behavior recorded in the code).

## Open Questions

None block planning. The spec's `TODO(待确认)` items are explicitly deferred; the plan's
tasks may add tests that lock the current behavior but must not change it.

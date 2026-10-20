# Research: Editor Shell, Commands and Preferences (As-Is)

**Feature**: `010-editor-shell` | **Date**: 2026-10-20

## Method

Brownfield as-is analysis of the existing shell modules and their tests. No product
behavior was invented; the two open questions from the spec remain `TODO(待确认)` and are
out of the change scope.

## D-001: Verification-first, no shell redesign

- **Decision**: Deliver documentation plus automated coverage for the existing menu,
  shortcut, toolbar, options and title rules. Change production code only if a test exposes
  a real defect.
- **Rationale**: The shell is widely used and highly visible; a redesign would be a large
  behavioral change without a requirement.
- **Alternatives considered**: Consolidating menus/toolbars into a new command registry
  (rejected: architecture-level change); moving options into the main process (rejected:
  storage-format change).

## D-002: Menu structure from `labelShopMenus`

- **Decision**: `buildLabelShopMenus(deps)` remains the single source. It returns the
  editor sections, the start-page sections and the context items; menu rendering only
  displays what it returns.
- **Rationale**: Menu labels, shortcuts and actions are already centralized and localised
  through `menu.en-US` by `007-i18n`. Duplicating them in components would drift.
- **Alternatives considered**: Declarative JSON menus (rejected: no benefit, would require
  rewriting action wiring).

## D-003: One availability source

- **Decision**: Enable/disable rules stay in `editorAvailability` and are consumed by both
  menus and toolbars.
- **Rationale**: The current rule set (document, selection count, group, database) is
  shared; duplicating it is the documented red line.
- **Alternatives considered**: Per-surface conditions (rejected: the original drift bug).

## D-004: Shortcut split and editable-target guard

- **Decision**: Keep the current split:
  - Global: Ctrl+S/N/O/P/F, F1 (and Ctrl+W) run even when focus is in an editable control.
  - Canvas commands: undo/redo, cut/copy/paste/select-all, delete, group/ungroup, lock,
    order, zoom, object info, export image, next object, tool letters
    (`s/b/t/l/u/r/p/d/g`), arrow nudges (0.5 mm, Shift 5 mm) are ignored while focus is in
    an INPUT/TEXTAREA/SELECT/contentEditable.
  - Escape clears selection; Alt+Enter opens properties.
- **Rationale**: Matches the current handler and prevents destructive canvas edits while
  typing into a form control.
- **Alternatives considered**: A configurable shortcut map (rejected: no requirement);
  blocking every key in inputs (rejected: breaks save/print/help from dialogs).

## D-005: Toolbar layout and assigned keys

- **Decision**: Persist `{ order, hidden, keys }`. Normalisation keeps only known button
  keys, deduplicates order, appends missing buttons in registry order, and drops empty key
  bindings. Visibility also honours group visibility. Assigned keys are matched with
  `matchToolbarKey` (`Ctrl+1`, `Alt+F1`, `Shift+F2`).
- **Rationale**: This is the existing `normalizeToolbarLayout` contract and keeps old/new
  option files compatible.
- **Alternatives considered**: Storing only visible buttons (rejected: loses order for
  re-enabling); storing group+button nesting (rejected: current flat model is sufficient).

## D-006: Preferences storage

- **Decision**: `AppOptions` persists in renderer `localStorage` under `maxlabel.options`;
  the cloud server URL is additionally mirrored to `maxlabel_server_url` because the
  license dialog reads it. The main process stores `skipNewWizard` in
  `userData/app-config.json`. Invalid values are clamped/defaulted by
  `normalizeAppOptions`.
- **Rationale**: Matches the current code and avoids changing a persisted format.
- **Alternatives considered**: Moving all options to the main process (rejected: migration
  and IPC surface); per-document storage (rejected: options are user-level).

## D-007: Session-only view state

- **Decision**: Panel visibility (`showToolbar`, `showFormatBar`, …) and theme live in
  `useViewPreferences` component state and reset on restart. `showRulers`/`showGrid` are
  separate `AppOptions` fields and do persist.
- **Rationale**: Matches current behavior; the spec records persistence as `TODO(待确认)`.
- **Alternatives considered**: Persisting view state now (deferred: owner decision).

## D-008: Window title and MFC accelerators

- **Decision**: `composeWindowTitle` builds
  `MaxLabel [activated|not activated] V<version> (<login|signed-out hint>) - <document|start page>`.
  `displayMfcCaption` hides a single `&` and renders `&&` as `&`; `acceleratorOf` returns
  the accelerator character.
- **Rationale**: Mirrors the LabelShop/MFC title and accelerator behavior recorded in the
  code; `007-i18n` localizes the activation/login/start-page segments.
- **Alternatives considered**: Keeping Electron's default title (rejected: loses version,
  login and document context); showing `&` literally (rejected: visible parity defect).

## Open Questions (deferred)

- Should panel visibility/theme persist across sessions? TODO(待确认).
- How should `startWithWizard` (`AppOptions`) relate to `appConfig.skipNewWizard`
  (main-process file)? TODO(待确认). The plan locks current behavior and does not merge them.

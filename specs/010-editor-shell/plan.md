# Implementation Plan: Editor Shell, Commands and Preferences (As-Is)

**Branch**: `010-editor-shell` | **Date**: 2026-10-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-editor-shell/spec.md`

**Note**: Brownfield **as-is** baseline. The plan closes documentation and test gaps around
shipped menu, shortcut, toolbar, options, view and window-title behavior; it does not add a
new UI feature.

## Summary

Document and verify the desktop shell: the LabelShop-compatible menu structure, the shared
command-availability rules, keyboard shortcuts (including editable-target guards), the
toolbar with its group/button customisation and key bindings, the four-page system options
dialog and its persisted `AppOptions`, session-level view preferences and themes, zoom/fit
and label rotation, multi-document tabs, and the MFC-compatible window title and `&`
accelerator display. Runtime behavior stays unchanged; new tests pin the current rules.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Electron 44.3.0, Fabric.js

**Primary Dependencies**: No new runtime dependency. Existing React shell, `labelShopMenus`,
`toolbarLayout`, `OptionsDialog`/`AppOptions`, `useLabelShopShortcuts`,
`editorAvailability`, `useViewPreferences`, `appTitle`/`mfcCaption`.

**Storage**: Renderer `localStorage` keys `maxlabel.options` and `maxlabel_server_url`
(normalized `AppOptions`, including toolbar groups/layout); main-process
`app-config.json` (`skipNewWizard` via `app:config-load/save`); `maxlabel.installedPrinters`
and `maxlabel.firstRun` are related but owned elsewhere. View panel visibility and theme
are session state, not persisted.

**Testing**: Vitest (unit/contracts/integration) and Playwright Electron E2E. Existing
coverage: `options-i18n`, `key-input-order`, i18n E2E and workspace harness. New tests are
required before any behavior change; this plan adds unit tests for menu structure,
availability, shortcuts, toolbar normalisation/key matching, options normalisation and
title/accelerator handling, plus an E2E smoke for the shell.

**Target Platform**: Windows 10/11 x64 primary; macOS/Linux builds per `005-cross-platform`.

**Project Type**: Desktop application (Electron main/preload/renderer/shared).

**Performance Goals**: No product-level SLO. Menu/toolbar construction and key handling are
synchronous; the shell must stay responsive while documents are open.

**Constraints**: No new dependency; no change to command semantics; menu structure and
shortcut set follow the LabelShop 6.37 reference; user-visible strings are localised by
`007-i18n`; command availability has exactly one source.

**Scale/Scope**: 12 editor menu sections plus start-page and context menus; ~184 menu
labels; 8 toolbar groups / 35 buttons; 4 options tabs; ~28 `AppOptions` fields; ~30 built-in
shortcuts plus per-button custom bindings.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status | Notes |
|-----------|------|--------|-------|
| I. 测试先行（TDD） | New tests written and seen failing before code changes | **PASS** | Plan tasks start with failing tests for menu structure, availability, shortcuts, toolbar layout, options and title. Existing behavior is verified, not reimplemented. |
| II. 先澄清，不猜测 | Ambiguities recorded, not guessed | **PASS (bounded)** | Two open items stay `TODO(待确认)`: whether view panel/theme should persist, and the relationship between `startWithWizard` and `appConfig.skipNewWizard`. The plan locks current behavior only. |
| III. 巨大架构变更先确认 | No architecture-level change | **PASS** | No new dependency, process, storage format or IPC. Menu/toolbar/preferences stay in the renderer; `app-config.json` is unchanged. |
| Single source of rules | Availability/labels/layout not duplicated | **PASS** | `editorAvailability`, `labelShopMenus`, `toolbarLayout` and `normalizeAppOptions` remain the only sources; tests import them. |
| Evidence rule | Every FR traces to code/tests | **PASS** | Each FR in `spec.md` carries `Evidence:`; this plan adds tests for the rules that currently only have code evidence. |

**Post-design re-check**: unchanged; no violations, no complexity exceptions.

## Project Structure

### Documentation (this feature)

```text
specs/010-editor-shell/
├── plan.md              # This file
├── spec.md              # As-is specification
├── research.md          # Phase 0 decisions
├── data-model.md        # AppOptions, toolbar layout, menu/availability entities
├── quickstart.md        # Validation scenarios
├── contracts/
│   ├── menu-command-contract.md
│   ├── toolbar-layout.md
│   └── preferences.md
└── checklists/
    └── requirements.md
```

`tasks.md` is produced by `/speckit-tasks`.

### Source Code (repository root)

```text
app/src/renderer/src/
├── features/commands/
│   ├── labelShopMenus.ts        # 12 editor sections, start/context menus, command actions
│   └── useLabelShopShortcuts.ts # keyboard bindings and editable-target guard
├── features/editor/editorAvailability.ts  # shared enable/disable rules
├── editor/
│   ├── MenuBar.tsx              # menu rendering and Item types
│   ├── Toolbar.tsx              # visible buttons + assigned-key handling
│   ├── toolbarLayout.ts         # groups, button registry, layout normalisation
│   ├── TabStrip.tsx             # document tabs
│   └── WorkArea.tsx             # zoom/fit modes, rulers, label rotation
├── dialogs/
│   ├── OptionsDialog.tsx        # AppOptions model, 4 tabs, load/save/normalise
│   └── CustomizeToolbarDialog.tsx
├── features/shell/
│   ├── useViewPreferences.ts    # session theme/panel visibility
│   └── useWindowTitle.ts
└── App.tsx                      # wires menus/toolbar/shortcuts/tabs/options

app/src/shared/
├── appTitle.ts                  # window title composition
└── mfcCaption.ts                # & accelerator display rules

app/src/main/appConfig.ts        # skipNewWizard persistence (app-config.json)

app/tests/
├── unit/renderer/               # menu, availability, shortcuts, toolbar, options, title
└── e2e/                         # shell smoke (menus/toolbar/options/title)
```

**Structure Decision**: Keep behaviour and data in the existing modules under
`features/commands`, `features/editor`, `editor`, `dialogs` and `features/shell`. No new
module, package, process or persisted key is introduced.

## Phase 0 — Research

See [research.md](./research.md). Decisions:

- D-001: As-is verification and test-gap closure; no shell redesign.
- D-002: `labelShopMenus` is the single menu source; `buildLabelShopMenus` returns editor
  sections, start-page sections and context items.
- D-003: Command availability is derived only from `editorAvailability`.
- D-004: Shortcuts are split into global commands (save/new/open/print/help) and canvas
  commands blocked in editable targets; single-letter tools and arrow nudges are included.
- D-005: Toolbar layout is `{ order, hidden, keys }`, normalised against the known button
  registry; assigned keys are matched by `matchToolbarKey`.
- D-006: `AppOptions` persists in `localStorage` under `maxlabel.options` (plus
  `maxlabel_server_url`); unknown/invalid values fall back to defaults.
- D-007: View panel visibility and theme are session-only; persistence is a deferred
  `TODO(待确认)`.
- D-008: Window title follows `composeWindowTitle`; MFC `&` accelerators are display-only.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md): `MenuSection`/`MenuItem`, `EditorAvailability`,
  `ToolbarLayout`/`ToolbarGroupVisibility`, `AppOptions`, `DocTab`, `ViewPreferences`,
  `WindowTitleParts`, validation/normalisation.
- [contracts/menu-command-contract.md](./contracts/menu-command-contract.md): section
  order, item shape, availability/disabled rules, action wiring.
- [contracts/toolbar-layout.md](./contracts/toolbar-layout.md): layout payload,
  normalisation, visibility and key matching.
- [contracts/preferences.md](./contracts/preferences.md): localStorage keys, `AppOptions`
  defaults/clamps, main `app-config.json`, session view state.
- [quickstart.md](./quickstart.md): automated and manual validation scenarios.

## Complexity Tracking

No constitution violations; no complexity exceptions.

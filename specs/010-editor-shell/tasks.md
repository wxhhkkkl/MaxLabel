---
description: "Task list for editor shell, commands and preferences (as-is verification)"
---

# Tasks: Editor Shell, Commands and Preferences (As-Is)

**Input**: Design documents from `specs/010-editor-shell/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`,
`quickstart.md`

**Tests**: Required (project constitution). New tests are written and seen failing before
any production-code change. This is an as-is feature: production changes are limited to
behaviour-preserving extractions that make the rules unit-testable. A test that exposes a
mismatch is a stop-and-clarify point.

**Organization**: Tasks follow the four user stories. US1 (menus/shortcuts/commands) is the
MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: `[US1]` … `[US4]` for user-story phases only
- Every task names an exact file path or command

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared shell test fixtures.

- [X] T001 [P] Create editor-shell test fixtures (menu dependency stub factory, keyboard-event factory, printer/document builders) in `app/tests/helpers/editorShell.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T002 [P] Add a controllable `localStorage` stub helper in `app/tests/helpers/storage.ts` for options tests.
- [X] T003 Run `cd app && env -u ELECTRON_RUN_AS_NODE npm test` to confirm the baseline gate is green and record it in `specs/010-editor-shell/quickstart.md` (Validation record).

**Checkpoint**: Fixtures and baseline ready.

---

## Phase 3: User Story 1 - Menus, shortcuts and command availability (Priority: P1) 🎯 MVP

**Goal**: The LabelShop menu structure, shared availability rules and keyboard shortcuts
behave as documented, including the editable-target guard.

**Independent Test**: On the start page document commands are disabled; with two objects
selected “组合” is enabled and Ctrl+G groups them; in an input field Ctrl+Z does not undo
the canvas.

### Tests for User Story 1

- [X] T004 [P] [US1] Write failing menu-structure tests (12 editor sections in order, item/divider/submenu shape, disabled/checked flags, start-page and context menus) using `buildLabelShopMenus` in `app/tests/unit/renderer/editor-menus.test.ts`.
- [X] T005 [P] [US1] Write failing availability tests for 0/1/2/3 selections, group/ungroup, database navigation and document presence in `app/tests/unit/renderer/editor-availability.test.ts`.
- [X] T006 [P] [US1] Write failing shortcut tests (global vs canvas commands, editable-target guard, tool letters `s/b/t/l/u/r/p/d/g`, 0.5 mm / Shift 5 mm nudges, Escape/Alt+Enter) against a pure handler in `app/tests/unit/renderer/editor-shortcuts.test.ts`.

### Implementation for User Story 1

- [X] T007 [US1] Extract the keydown decision logic from `app/src/renderer/src/features/commands/useLabelShopShortcuts.ts` into a pure `handleLabelShopShortcut(event, actions)` in `app/src/renderer/src/features/commands/shortcutHandler.ts`, keep the hook as a thin wrapper, and make T006 pass (no behavior change).
- [X] T008 [US1] Verify `app/src/renderer/src/features/commands/labelShopMenus.ts` against T004; adjust only the test or an exported pure constant, never command semantics.
- [X] T009 [US1] Verify `app/src/renderer/src/features/editor/editorAvailability.ts` against T005; no behavior change.
- [X] T010 [US1] Add E2E coverage in `app/tests/e2e/editor-shell.spec.ts`: start-page document commands disabled, document menu/toolbar actions enabled, Ctrl+G groups two selected objects, and Ctrl+Z in a text input does not undo the canvas.

**Checkpoint**: US1 works independently with the real shell.

---

## Phase 4: User Story 2 - Toolbar customisation and system options (Priority: P2)

**Goal**: Toolbar groups/buttons and assigned keys persist through `AppOptions`, and the
four options pages normalise/round-trip their values.

**Independent Test**: Hide a group, hide a button, assign `Ctrl+Shift+P` to Print, restart,
and confirm the layout/key survive; corrupt options JSON falls back to defaults.

### Tests for User Story 2

- [X] T011 [P] [US2] Write failing toolbar tests (8 groups, 35 buttons, order/hidden/keys normalisation, missing/unknown keys, `visibleToolbarButtons`, `matchToolbarKey`, `formatToolbarKey`) in `app/tests/unit/renderer/toolbar-layout.test.ts`.
- [X] T012 [P] [US2] Write failing AppOptions tests (defaults, clamps 1–10000/1–100/0–1000, enums, `#rrggbb`, corrupt-JSON fallback, localStorage round-trip, server URL mirror) in `app/tests/unit/renderer/app-options.test.ts`.

### Implementation for User Story 2

- [X] T013 [US2] Verify `app/src/renderer/src/editor/toolbarLayout.ts` against T011; no behavior change.
- [X] T014 [US2] Verify `normalizeAppOptions`, `loadOptions` and `saveOptions` in `app/src/renderer/src/dialogs/OptionsDialog.tsx` against T012; no behavior change.
- [X] T015 [US2] Add E2E coverage in `app/tests/e2e/editor-shell.spec.ts`: hide a toolbar group, assign `Ctrl+Shift+P` to Print, reload, and confirm persistence; save language/unit options and confirm they survive a reload.
- [X] T016 [US2] Verify `app/src/renderer/src/dialogs/CustomizeToolbarDialog.tsx` writes `{ order, hidden, keys }` through `normalizeToolbarLayout` and that the reset action restores defaults.

**Checkpoint**: Toolbar and options persist and normalise correctly.

---

## Phase 5: User Story 3 - View, theme, zoom and tabs (Priority: P2)

**Goal**: Panel visibility/theme, fit/manual zoom, label rotation and multi-document tabs
behave as documented.

**Independent Test**: Hide status bar and print panel, switch theme, use fit width/window,
manually zoom to 150% (resize keeps it), rotate the layout 90°, and switch between two tabs
without losing selection/history.

### Tests for User Story 3

- [X] T017 [P] [US3] Write failing view-preference tests (theme keys `blue/black/silver/aqua`, panel defaults true, session-only state) against extracted defaults in `app/tests/unit/renderer/view-preferences.test.ts`.
- [X] T018 [P] [US3] Write failing fit-zoom tests (`manual`, `w`, `h`, `win`, rotated width/height swap) against a pure `computeFitZoom` in `app/tests/unit/renderer/fit-zoom.test.ts`.

### Implementation for User Story 3

- [X] T019 [US3] Add `app/src/renderer/src/features/shell/viewPreferences.ts` with `THEMES`, `AppTheme` and default panel state, and wire `useViewPreferences.ts` to it (no behavior change) so T017 passes.
- [X] T020 [US3] Add `app/src/renderer/src/editor/fitZoom.ts` with `computeFitZoom` and wire `WorkArea.tsx` (no behavior change) so T018 passes.
- [X] T021 [US3] Add E2E coverage in `app/tests/e2e/editor-shell.spec.ts`: toggle panels, switch themes, use fit width/window, manual zoom survives resize, rotate the layout and verify hit-testing/paper outline.
- [X] T022 [US3] Add E2E coverage for two tabs (independent selection, zoom and undo history; reorder and close one tab without affecting the other) in `app/tests/e2e/editor-shell.spec.ts`.

**Checkpoint**: View/zoom/tabs work independently.

---

## Phase 6: User Story 4 - Window title and MFC accelerators (Priority: P3)

**Goal**: The window title follows the LabelShop structure and `&` accelerators are
displayed correctly.

**Independent Test**: The title shows `MaxLabel [..] V.. (..) - <document|起始页>` and a
label containing `(&B)` renders as `(B)`, while `&&` renders as `&`.

### Tests for User Story 4

- [X] T023 [P] [US4] Write failing title tests (activation, login email vs signed-out hint, document vs start page, language, version segment) in `app/tests/unit/shared/app-title.test.ts`.
- [X] T024 [P] [US4] Write failing MFC caption tests (single `&` hidden, `&&` one `&`, `acceleratorOf`) in `app/tests/unit/shared/mfc-caption.test.ts`.

### Implementation for User Story 4

- [X] T025 [US4] Verify `app/src/shared/appTitle.ts` against T023; no behavior change.
- [X] T026 [US4] Verify `app/src/shared/mfcCaption.ts` against T024; no behavior change.
- [X] T027 [US4] Add E2E assertions in `app/tests/e2e/editor-shell.spec.ts`: title changes when switching from the start page to a named document; object-properties labels contain no literal `(&X)`.

**Checkpoint**: Title and accelerator display are verified.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T028 [P] Update `app/tests/INDEX.md` and `app/tests/README.md` with the editor-shell test files.
- [X] T029 Run the full gate: `cd app && env -u ELECTRON_RUN_AS_NODE npm test`, `npm run test:coverage`, and `env -u ELECTRON_RUN_AS_NODE npm run test:e2e`; record results in `specs/010-editor-shell/quickstart.md`.
- [X] T030 Run manual validation V-01–V-06 from `specs/010-editor-shell/quickstart.md` and record the outcomes there.
- [X] T031 Update `specs/010-editor-shell/spec.md`/`data-model.md` only for confirmed as-is corrections found during verification; leave the two `TODO(待确认)` items unresolved unless the owner decides.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → no dependencies.
- **Foundational (Phase 2)** → depends on Setup; blocks all stories.
- **US1 (Phase 3)** → depends on Foundational; MVP.
- **US2 (Phase 4)** → depends on Foundational; independent of US1 for options/toolbar data.
- **US3 (Phase 5)** → depends on Foundational; uses toolbar/view defaults but is independently testable.
- **US4 (Phase 6)** → depends on Foundational; independent.
- **Polish (Phase 7)** → depends on the desired stories.

### Within Each Story

- Tests first, seen failing, then the behavior-preserving extraction that makes them pass.
- No change to command semantics, menu order, storage keys or the title format.
- A test that exposes a mismatch is a stop-and-clarify point.

### Parallel Opportunities

- T001/T002 fixtures and baseline.
- T004/T005/T006; T011/T012; T017/T018; T023/T024 (different files).
- T028 documentation while the gate runs.

---

## Parallel Example: User Story 1

```text
T004  menu structure tests        tests/unit/renderer/editor-menus.test.ts
T005  availability tests          tests/unit/renderer/editor-availability.test.ts
T006  shortcut tests              tests/unit/renderer/editor-shortcuts.test.ts
```

---

## Implementation Strategy

### MVP First

1. Setup + Foundational (T001–T003).
2. US1 (T004–T010).
3. **STOP and VALIDATE**: menus, availability and shortcuts on a real document.

### Incremental Delivery

1. US1 → commands and shortcuts verified.
2. US2 → toolbar/options persistence verified.
3. US3 → view/zoom/tabs verified.
4. US4 → title and accelerators verified.
5. Polish → full gate and recorded validation.

### Safety Rules

- Do not change menu order, command semantics, shortcut bindings or storage keys.
- Do not persist session-only view/theme state without an owner decision.
- Do not merge `startWithWizard` and `skipNewWizard`.
- Do not enable currently disabled commands (e.g. 导出打印机指令文件) as part of this feature.
- Keep availability and labels in their single-source modules.

## Notes

- This feature documents and verifies shipped behavior; "implementation" tasks are
  behaviour-preserving extractions that make the rules unit-testable.
- The English UI is covered by `007-i18n`; these tasks only verify shell structure.
- No printer or scale hardware is required.

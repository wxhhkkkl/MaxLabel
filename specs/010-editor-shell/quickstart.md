# Quickstart: Editor Shell, Commands and Preferences (As-Is)

**Feature**: `010-editor-shell` | **Date**: 2026-10-20

## Prerequisites

- Windows 10/11 x64 primary; Node.js ≥ 22.12.0; `npm install` completed.
- `app/` builds and the existing test gate passes.
- No printer or scale is required for the shell scenarios.

## Automated validation

```bash
cd app
npm test
npm run test:coverage
env -u ELECTRON_RUN_AS_NODE npm run test:e2e
```

### Existing evidence

- `tests/unit/renderer/options-i18n.test.ts` — options language/formatting.
- `tests/unit/shared/i18n/catalog-coverage.test.ts` — menu/toolbar label coverage.
- `tests/e2e/i18n.spec.ts` — English menu/toolbar/dialog surfaces.
- `tests/e2e/workspace-harness.spec.ts` — rulers, fit modes, zoom and clipping.

### Planned coverage (tests first, then code only if a test exposes a defect)

| Behavior | Test file | Layer |
|----------|-----------|-------|
| Menu section order, item shape and disabled state | `tests/unit/renderer/editor-menus.test.ts` | unit |
| Command availability thresholds (0/1/2/3 selections) | `tests/unit/renderer/editor-availability.test.ts` | unit |
| Shortcut bindings and editable-target guard | `tests/unit/renderer/editor-shortcuts.test.ts` | unit |
| Toolbar group/button registry, layout normalisation and key matching | `tests/unit/renderer/toolbar-layout.test.ts` | unit |
| `AppOptions` defaults/clamps, localStorage round-trip and corrupt fallback | `tests/unit/renderer/app-options.test.ts` | unit |
| Window title composition and MFC `&` handling | `tests/unit/shared/app-title.test.ts`, `tests/unit/shared/mfc-caption.test.ts` | unit |
| Shell smoke: menu/toolbar/options/theme/tabs/title | `tests/e2e/editor-shell.spec.ts` | e2e |

If a planned test exposes a mismatch, decide which side encodes the intended as-is behavior
before changing code.

## Manual validation

### V-01 Menus and shortcuts

1. Open a document with two objects; select both.
2. Use File/Edit/View/Object/Database menus and the documented shortcuts.
3. Check that document commands are disabled on the start page.

Expected: commands run once per action; group requires two selections; shortcuts and menu
items produce the same result.

### V-02 Editable-target guard

1. Focus the template-name field (or any input) and press Ctrl+Z/X/C/V/A.
2. Press Ctrl+S and F1 while the field is focused.

Expected: canvas undo/cut/copy/paste/select-all do not fire; save/help still work; the text
control behaves natively.

### V-03 Toolbar customisation

1. Hide a group via “添加或删除按钮 → 标准”.
2. Open “自定义...”, move a button up, hide another, assign `Ctrl+Shift+P` to Print.
3. Save, restart the app, then reset the layout.

Expected: the layout persists across restart; the assigned key triggers Print; reset
restores registry order, all groups visible, no keys.

### V-04 System options

1. Change language, unit, script toggle, default label geometry, print mode/command set/DPI
   and grid/ruler visibility; save.
2. Restart and inspect the same fields.
3. Corrupt `localStorage.maxlabel.options` with invalid JSON and restart.

Expected: values persist; invalid JSON falls back to defaults without a crash; server URL
still round-trips via `maxlabel_server_url`.

### V-05 View, zoom and rotation

1. Toggle toolbar/format bar/align bar/status bar/print panel/object info.
2. Switch theme blue → black → silver → aqua.
3. Use fit width/height/window, manual zoom, and rotate the label layout 90°.

Expected: each panel toggles independently; themes change the CSS variables; manual zoom
survives window resize; fit modes recompute; rotated canvas hit-testing stays correct.

### V-06 Tabs, title and accelerators

1. Open several templates; switch, reorder and close tabs.
2. Observe the window title on the start page and with a named document.
3. Open object properties and check labels that contain `(&B)`.

Expected: tabs keep independent document/selection/history; the title follows
`MaxLabel [..] V.. (..) - <document|起始页>`; `&` is not rendered literally and `&&`
renders as one `&`.

## Validation record (2026-10-20)

| Gate | Command | Result |
|------|---------|--------|
| Baseline before changes | `env -u ELECTRON_RUN_AS_NODE npm test` | 522 tests / 23 E2E PASS |
| Typecheck (node/web/test) + Vitest | `env -u ELECTRON_RUN_AS_NODE npm test` | 87 files / 565 tests PASS |
| Coverage (`shared/domain` + `shared/print`, 80% lines) | `npm run test:coverage` | PASS — 86.88% lines |
| Playwright Electron E2E | `env -u ELECTRON_RUN_AS_NODE npx playwright test` | 28 passed |

Scenario evidence:

| Scenario | Evidence | Result |
|----------|----------|--------|
| V-01 menus and shortcuts | `unit/renderer/editor-{menus,availability,shortcuts}.test.ts`, `e2e/editor-shell.spec.ts` | PASS |
| V-02 editable-target guard | `unit/renderer/editor-shortcuts.test.ts` (input guard for canvas commands, global save/help still run) | PASS (unit-level; not driven through a real text field in E2E) |
| V-03 toolbar customisation | `unit/renderer/toolbar-layout.test.ts`, `e2e/editor-shell.spec.ts` (hide help group, reload) | PASS |
| V-04 system options | `unit/renderer/app-options.test.ts` (defaults/clamps/corrupt fallback/round-trip) | PASS (unit-level; options dialog save/reload not re-driven in E2E) |
| V-05 view, theme, zoom, rotation | `e2e/editor-shell.spec.ts`, `unit/renderer/{view-preferences,fit-zoom}.test.ts` | PASS |
| V-06 tabs, title, accelerators | `e2e/editor-shell.spec.ts`, `unit/shared/{app-title,mfc-caption}.test.ts` | PASS |

Not exercised automatically: real keyboard focus in every dialog control, OS-level window
chrome behaviour, and persistence across an application reinstall. No shell behaviour was
changed to satisfy these scenarios.

## Known boundaries (do not change without owner confirmation)

- Panel visibility and theme are session-only and reset on restart (`TODO(待确认)`).
- `startWithWizard` (renderer options) and `appConfig.skipNewWizard` (main file) are two
  separate flags; their intended relationship is `TODO(待确认)`.
- “导出打印机指令文件(E)” is currently rendered disabled in the File menu even though a
  handler exists. This is recorded as-is; enabling it is a product decision.
- The menu `shortcut` text is display-only; actual key handling is owned by the shortcut
  hook and toolbar key bindings.

## Out of scope

- Adding new commands, menus, toolbar buttons or themes.
- Changing persisted formats or moving options to the main process.
- Translating strings (owned by `007-i18n`).

# Contract: Preferences and Window Title

**Feature**: `010-editor-shell` | **Date**: 2026-10-20

## Renderer preferences

| Key | Read | Write | Notes |
|-----|------|-------|-------|
| `maxlabel.options` | `loadOptions()` | `saveOptions()` | JSON `AppOptions`, normalised on both paths |
| `maxlabel_server_url` | `loadOptions()` overrides `serverUrl` | `saveOptions()` mirrors it | Single source shared with the license dialog |
| `maxlabel.installedPrinters` | printer picker | install/uninstall printers | Owned by the printer catalog flow |
| `maxlabel.firstRun` | startup effect | set on first render | Drives the first-run guide |

- Corrupt `maxlabel.options` JSON or unavailable storage → `DEFAULTS`; the app must not
  crash.
- Saving may fail (quota/disabled storage); in-memory options still apply for the session.
- On the very first launch (`maxlabel.options` absent), `language` follows the OS
  (`detectBrowserLanguage`); otherwise it is whatever was saved.
- `normalizeAppOptions` clamps/validates every field as documented in `data-model.md`
  (ranges, enums, booleans, `#rrggbb`, server URL length). Unknown fields are dropped.

## Main-process app config

`userData/app-config.json`:

```json
{ "skipNewWizard": false }
```

- Read via `app:config-load`, written via `app:config-save` (patch merge).
- Missing/corrupt file → defaults; writes use a temporary file + rename.
- This is separate from the renderer `startWithWizard` option; their relationship is
  `TODO(待确认)` and must not be changed without an owner decision.

## Session-only view state

`useViewPreferences` holds `showToolbar`, `showFormatBar`, `showAlignBar`, `showStatusBar`,
`showPrintPanel`, `showLayerPanel`, `showObjectInfo` and `appTheme`. It is not read from or
written to storage; restarting resets it. `showRulers` and `showGrid` are persisted
`AppOptions` fields instead.

## Window title

- `composeWindowTitle(parts)` returns
  `MaxLabel [<activation>] V<version> (<login>) - <document>`.
- `useWindowTitle` fetches the version once via `app:version`, does not write a title until
  the version arrives, then sets `document.title` and calls `app:window-title`.
- Localised segments come from the `title.*` catalog keys (`007-i18n`).

## MFC captions

- `displayMfcCaption(text)`: single `&` is removed; `&&` becomes one `&`.
- `acceleratorOf(text)`: returns the character following a single `&`, or `null`.
- Titles must not show literal `(&X)` to the user.

## Non-goals

- Migrating preferences to `app-config.json` or a database.
- Persisting view/theme state (deferred `TODO(待确认)`).
- Changing the window-title segments or their order.

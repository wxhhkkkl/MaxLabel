# Data Model: Editor Shell, Commands and Preferences (As-Is)

**Feature**: `010-editor-shell` | **Date**: 2026-10-20

## MenuSection / MenuItem

Returned by `buildLabelShopMenus(deps)`.

| Field | Type | Meaning |
|-------|------|---------|
| `title` | string | Section label with MFC accelerator, e.g. `文件(F)` |
| `items` | MenuItem[] | Ordered items |
| `label` | string | Item label; may contain `(&X)` accelerator notation |
| `shortcut` | string? | Display-only shortcut text, e.g. `Ctrl+S` |
| `disabled` | boolean? | Command unavailable |
| `checked` | boolean? | Toggle-style item |
| `radio` | boolean? | Radio-style item (themes) |
| `divider` | boolean? | Separator |
| `children` | MenuItem[]? | Submenu (recent files, label rotation, align/size …) |
| `action` | () => void | Command |

Editor section order: 文件(F)、编辑(E)、查看(V)、工具(T)、排列(A)、数据库(D)、账户(A)、
云服务(C)、选项(O)、窗口(W)、帮助(H)、建议与反馈。The start page uses `startMenus`, and a
right-click opens `contextItems`; both are returned by the same builder.

`shortcut` is display metadata. Execution is owned by `useLabelShopShortcuts` (global
bindings) and `Toolbar.tsx` (per-button bindings).

## EditorAvailability

Computed once from `{ isStart, hasDatabase, selectionCount, selectedGroup }`.

| Field | Rule |
|-------|------|
| `hasDocument` | `!isStart` |
| `hasDatabase` | document + database |
| `hasSelection` | document + selectionCount > 0 |
| `canGroup` | selectionCount ≥ 2 |
| `canUngroup` | exactly 1 selected object and it is a group |
| `canDatabaseNavigate` | document + database |
| `canAlignObjects` / `canSizeObjects` | selectionCount ≥ 2 |
| `canDistribute` | selectionCount ≥ 3 |

## Toolbar registry and layout

- **Groups** (8): `file`, `edit`, `history`, `print`, `object`, `database`, `view`, `help`.
- **Buttons** (35): registered in `TOOLBAR_BUTTONS` with `key`, `group`, `label`.
- **ToolbarGroupVisibility**: `Record<ToolbarGroupKey, boolean>`; unknown keys dropped,
  missing keys default to `true`.
- **ToolbarLayout**:

| Field | Type | Rules |
|-------|------|-------|
| `order` | string[] | known button keys, deduplicated; missing buttons appended in registry order |
| `hidden` | string[] | known button keys only |
| `keys` | Record<string,string> | known button → non-empty binding such as `Ctrl+1` |

`visibleToolbarButtons(layout, groups)` = ordered keys that are not hidden and whose group
is not disabled.

`matchToolbarKey(binding, event)` compares the last token to `event.key` and requires the
`Ctrl`/`Alt`/`Shift` modifiers to match exactly.

## AppOptions

Persisted in `localStorage` under `maxlabel.options` (server URL also in
`maxlabel_server_url`). Normalisation rules:

| Field | Default | Rule |
|-------|---------|------|
| `language` | `zh-CN` (OS-detected on first launch) | `en-US` or `zh-CN` |
| `unit` | `mm` | `mm` or `inch` |
| `printNonPrintable` | `true` | boolean |
| `deselectNonPrintable` | `false` | boolean |
| `allowScript` | `false` | boolean |
| `workspaceBg` | `#22BDED` | `#rrggbb` only |
| `serverUrl` | `http://127.0.0.1:8420` | trimmed string, ≤2048 |
| `defaultLabelW` / `defaultLabelH` | 60 / 40 | 1–10000 |
| `labelRows` / `labelCols` | 1 / 1 | integer 1–100 |
| `rowGapMm` / `colGapMm` | 2 / 2 | 0–1000 |
| `labelShape` | `rect` | `rect`/`roundRect`/`ellipse` |
| `defaultPrintMode` | `driver` | `driver`/`command` |
| `defaultCommandSet` | `tspl` | `tspl`/`zpl`/`cpcl`/`escpos` |
| `defaultDpi` | 203 | 203/300/600 |
| `useMultipleDatabaseConnections` | `false` | boolean |
| `startWithWizard` | `false` | boolean |
| `showRulers` | `true` | boolean |
| `showGrid` | `false` | boolean |
| `autoRotateOutput` | `false` | boolean |
| `autoOpenObjectProps` | `false` | boolean |
| `tableKeepSizeOnResize` | `false` | boolean |
| `toolbarGroups` | all visible | `normalizeToolbarGroups` |
| `toolbarLayout` | registry order, none hidden, no keys | `normalizeToolbarLayout` |

Corrupt JSON or storage failures fall back to `DEFAULTS`; saving failures keep the
in-memory options for the session.

## ViewPreferences (session-only)

`showToolbar`, `showFormatBar`, `showAlignBar`, `showStatusBar`, `showPrintPanel`,
`showLayerPanel`, `showObjectInfo` (all default `true`) and `appTheme`
(`blue` default, `black`, `silver`, `aqua`). Not persisted (TODO(待确认)).

## DocTab

`key`, `title`, `doc`, `selectedId`, `count`, `printCount`, `copies`, `datasetName`,
`zoom`, optional `zoomMode` (`manual`/`win`/`w`/`h`), `tool`, `recordIdx`, `startLabel`,
`path`, `dirty`, `revision`. Each tab owns its document, selection, zoom/tool and undo
history.

## WindowTitleParts

`productName`, `activated`, `version`, `loginEmail | null`, `documentTitle | null`,
`language`. `composeWindowTitle` produces:

```text
MaxLabel [activated|not activated] V<version> (<login|signed-out>) - <document|start page>
```

## MFC caption

`displayMfcCaption` removes a single `&` (accelerator marker) and renders `&&` as `&`;
`acceleratorOf` returns the next character after a single `&`, or `null`.

## Main-process AppConfig

`userData/app-config.json` with `skipNewWizard: boolean`, read/written by
`readAppConfig`/`saveAppConfig` via `app:config-load`/`app:config-save`. Separate from the
renderer `startWithWizard` option (TODO(待确认) relationship).

## Storage keys

| Key | Owner | Content |
|-----|-------|---------|
| `maxlabel.options` | renderer | normalized `AppOptions` |
| `maxlabel_server_url` | renderer | cloud/license server URL |
| `maxlabel.installedPrinters` | renderer | installed LabelShop printer IDs |
| `maxlabel.firstRun` | renderer | first-run flag |
| `app-config.json` | main | `skipNewWizard` |
| `print-log.jsonl` | main | print history (012) |

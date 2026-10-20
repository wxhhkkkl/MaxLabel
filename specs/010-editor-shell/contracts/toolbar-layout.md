# Contract: Toolbar Layout and Key Bindings

**Feature**: `010-editor-shell` | **Date**: 2026-10-20

## Registry

- 8 groups: `file`, `edit`, `history`, `print`, `object`, `database`, `view`, `help`.
- 35 buttons registered in `TOOLBAR_BUTTONS` (`key`, `group`, `label`).
- The registry is the only source for labels, group membership and key validation.

## Persisted layout

```ts
interface ToolbarLayout {
  order: string[]          // all known button keys, default = registry order
  hidden: string[]         // hidden button keys
  keys: Record<string, string> // button key -> "Ctrl+1" / "Alt+F1" / "Shift+F2"
}
```

## Normalisation

`normalizeToolbarLayout(value)`:

1. Keep only known button keys from `order`; deduplicate while preserving first position.
2. Append every known button missing from `order`, in registry order.
3. Filter `hidden` to known keys.
4. Keep `keys` only for known buttons and only non-empty trimmed strings.
5. Unknown/absent input yields `defaultToolbarLayout()`.

`normalizeToolbarGroups(value)` keeps known group keys; unknown keys are dropped and
missing groups default to visible.

## Visibility

```ts
visibleToolbarButtons(layout, groups) =
  layout.order.filter(key =>
    !layout.hidden.includes(key) &&
    (groups?.[groupOf(key)] ?? true) !== false
  )
```

The toolbar renders only the returned keys; groups and per-button hidden state combine
(button hidden OR group hidden → not rendered).

## Key matching

`matchToolbarKey(binding, event)`:

- Parse `binding` by `+`; the last token is the key, the previous tokens are modifiers.
- `Ctrl`, `Alt`, `Shift` must match exactly (including their absence).
- Compare `event.key` case-insensitively.
- Empty or modifier-only bindings never match.

`formatToolbarKey(event)` produces the display/storage form; modifier-only keydowns return
an empty string (not stored).

## Defaults and reset

- Default: registry order, nothing hidden, no assigned keys.
- “恢复默认窗体布局” resets `toolbarGroups` and `toolbarLayout` to defaults on save.

## Non-goals

- Changing the button set or group names.
- Supporting arbitrary key names, macros or multi-step sequences.
- Persisting layout anywhere other than `AppOptions`.

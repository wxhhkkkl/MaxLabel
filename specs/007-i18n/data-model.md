# Data Model: Bilingual UI (Chinese/English)

**Feature**: `007-i18n` | **Date**: 2026-10-19

## Language

```text
Language = 'zh-CN' | 'en-US'
```

- Exactly two supported values.
- `zh-CN` is the source/fallback language.
- Unknown, missing or malformed values normalize to `zh-CN`.

## LanguagePreference

| Field | Type | Rules |
|-------|------|-------|
| `language` | `Language` | Stored in the existing `maxlabel.options` localStorage object. |
| `source` | `'stored' \| 'detected' \| 'default'` | `stored` = user selected; `detected` = first launch OS language; `default` = fallback Chinese. |
| `updatedAt` | ISO timestamp (optional) | UI/diagnostic only; not required for behavior. |

State transitions:

1. First launch, no stored options → detect `navigator.language` (`en*` → `en-US`,
   `zh*` → `zh-CN`, otherwise `zh-CN`) → save on first explicit user save or immediately
   with the options object.
2. User selects a language → apply immediately to the UI → persist in `maxlabel.options`.
3. Restart → load `maxlabel.options`; invalid/missing → detect/default again.
4. A template is opened/saved → no language field is read or written.

## TranslationMessage

| Field | Type | Rules |
|-------|------|-------|
| `key` | string | Dotted namespace, stable, unique, never shown to users. |
| `zh-CN` | string | Source text; may contain `{name}` placeholders. |
| `en-US` | string | English text; must contain the same placeholders as the source. |
| `params` | `Record<string, string \| number>` (optional) | Named interpolation values supplied by `t()`. |

Validation rules:

- Both catalogs have exactly the same key set; extra/missing keys fail the completeness
  test.
- Empty or whitespace-only values count as missing.
- Placeholder sets must match across languages (a mismatch fails the completeness test).
- Runtime fallback: active language → `zh-CN` → raw key (development diagnostic only);
  missing/empty values are reported to the completeness log.

## HelpSection / HelpItem

| Field | Type | Rules |
|-------|------|-------|
| `key` | `'start' \| 'object' \| 'source' \| 'db' \| 'print' \| 'installprinter' \| 'shortcut' \| 'faq'` | Fixed set of eight sections. |
| `title` | translation key | Catalog-backed. |
| `intro` | translation key | Catalog-backed. |
| `items[].title` | translation key | Catalog-backed. |
| `items[].body` | translation key | Catalog-backed. |

- The section/item structure is shared across languages; only the translated values differ.
- The parity-only detailed help corpus is not represented in this model.

## LocalizedIpcError

| Field | Type | Rules |
|-------|------|-------|
| `message` | string | Existing raw message; always preserved for logs and fallback. |
| `messageKey` | string (optional) | Must exist in the shared catalog; empty keys are ignored. |
| `messageParams` | `Record<string, string \| number>` (optional) | Interpolation values for `messageKey`. |

Resolution order at the UI boundary:

1. `messageKey` exists and translates → show the translated string.
2. `messageKey` missing/empty or translation missing → show the raw `message`.
3. Neither → show the generic localized failure message for the operation.

## AppOptions Extension

Existing object in `app/src/renderer/src/dialogs/OptionsDialog.tsx`:

```text
language: 'zh-CN'                         // current
language: 'zh-CN' | 'en-US'               // target
```

- `DEFAULTS.language` remains `zh-CN`.
- `normalizeAppOptions` accepts `en-US` and maps everything else to `zh-CN`.
- No other option fields change.

# Contract: Translation Messages

**Feature**: `007-i18n` | **Date**: 2026-10-19

## Catalog Shape

Both catalogs are flat key/value objects with identical keys:

```text
zh-CN: Record<MessageKey, string>
en-US: Record<MessageKey, string>
```

- Keys use dotted namespaces: `menu.*`, `toolbar.*`, `editor.*`, `dialog.*`, `print.*`,
  `export.*`, `license.*`, `help.*`, `error.*`, `common.*`.
- Keys are stable identifiers and are never rendered to users.
- Values may contain named placeholders: `{name}`, `{count}`, `{printer}`.
- No HTML is allowed in values; help bodies are plain text rendered by the dialog.

## Interpolation

`t(language, key, params?)`:

- Replaces `{name}` with the string value of `params.name`.
- Missing parameters leave the placeholder untouched and are reported by the development
  completeness check.
- `params` values are stringified; no locale-dependent number formatting is applied by
  `t()` itself (callers format dates/numbers with `Intl` before interpolation).

## Parity and Fallback

- `zh-CN` and `en-US` MUST have exactly the same key set.
- Empty or whitespace-only values are treated as missing.
- Placeholder sets MUST match between languages for the same key.
- Resolution order: active language → `zh-CN` → raw key (development only).
- Missing/empty keys MUST be reported by the catalog completeness check (see below).

## Help Content

- The eight HelpDialog sections (`start`, `object`, `source`, `db`, `print`,
  `installprinter`, `shortcut`, `faq`) use catalog keys for section title, intro, item
  title and item body.
- The section/item topology is shared; only the values differ by language.
- The parity-only detailed help corpus is not part of this contract.

## Completeness Check

A test/CI check MUST:

1. Load both catalogs.
2. Report keys present in one catalog but not the other.
3. Report empty/whitespace-only values.
4. Report placeholder mismatches.
5. Report missing help-section keys.

The check MUST fail the fast gate when any of the above occurs. The English values are
authored by the implementation agent; the owner reviews product terminology after the
first complete pass.

# Contract: Localized IPC Errors

**Feature**: `007-i18n` | **Date**: 2026-10-19

## Additive Shape

User-facing IPC error results may add two optional fields; existing fields remain
unchanged:

```text
{
  ok: false,
  status?: ...,
  message: string,                 // existing raw message, always preserved
  messageKey?: string,             // optional stable translation key
  messageParams?: Record<string, string | number>
}
```

- `message` remains the authoritative fallback and is still suitable for logs.
- `messageKey` MUST name a key in the shared translation catalog.
- `messageParams` provides named interpolation values for `messageKey`.
- Neither field is required; old payloads remain valid.

## Channels in Scope (primary flows)

- `print-label`, `print-command`, `print-command-file`
- `template:save`, `template:open`, `template:saveTo`, `template:list`
- `license.*`
- shared validation errors that reach the user through the above channels

Additional channels may adopt the fields incrementally; a channel that does not provide
`messageKey` simply falls back to `message`.

## Renderer Resolution

1. If `messageKey` is present and translates → show the translated string.
2. If `messageKey` is missing/empty or the translation is missing → show `message`.
3. If neither is usable → show the localized generic failure message for the operation.

The renderer MUST NOT display raw keys, untranslated main-process strings when a key is
available, or an empty error.

## Security / Validation

- `messageKey` is looked up in the catalog, not evaluated or interpolated from arbitrary
  code.
- `messageParams` values are stringified and escaped by the UI rendering path; they are
  not passed to `eval`, HTML injection or shell commands.
- The main boundary continues to validate payloads as before; this contract only adds
  optional fields to results.

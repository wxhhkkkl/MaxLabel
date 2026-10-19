# Research: Bilingual UI (Chinese/English)

**Feature**: `007-i18n` | **Date**: 2026-10-19

## Current State (code evidence)

- `AppOptions` already contains `language: 'zh-CN'` and the general options page already
  renders a language `<select>` with a single `简体中文` option
  (`app/src/renderer/src/dialogs/OptionsDialog.tsx`). `normalizeAppOptions` currently
  forces `language: 'zh-CN'`, so the field is a placeholder rather than a switch.
- Options are persisted in `localStorage` under `maxlabel.options`; loading/saving is
  already centralized in `OptionsDialog.tsx` (`loadOptions`/`saveOptions`).
- User-facing UI strings are hard-coded Chinese across renderer components, menus,
  dialogs, status messages and validation text. The in-app HelpDialog has eight
  hard-coded Chinese sections (`app/src/renderer/src/dialogs/HelpDialog.tsx`).
- Main-process user-facing errors are Chinese `message` strings returned through IPC
  results (`app/src/main/ipc/validation.ts`, `registerPrintIpc.ts`, etc.).
- The detailed LabelShop help corpus (156 HTML, 230 PNG, 4 GIF, 1 HHC) exists only on the
  `parity` branch and is not packaged; `help:open` falls back to an external website when
  it is absent.

## D-001: Custom typed catalog, no external i18n dependency

- **Decision**: Add a shared typed catalog (`zh-CN`/`en-US`) plus a small `t()` helper and
  a React context/hook. Use `Intl` for locale-aware date/number/unit display.
- **Rationale**: The app has no i18n dependency, the supported languages are fixed, and
  the catalog must be shared with the main process. A typed object gives parity checks and
  compile-time key safety without adding a runtime or a second source of truth.
- **Alternatives considered**: `i18next`/`react-i18next` (more runtime/config than needed,
  and main-process sharing would still need a custom bridge); `react-intl` (formatting is
  useful, but the catalog/main sharing and key parity remain custom work). `Intl` covers
  the formatting we need without a dependency.

## D-002: Reuse `AppOptions.language` and localStorage for preference

- **Decision**: Extend the existing union to `'zh-CN' | 'en-US'`, normalize unknown values
  to Chinese, and use the existing `maxlabel.options` persistence. On first launch with
  no saved options, detect `navigator.language`: `en*` → English, `zh*` → Chinese,
  otherwise Chinese.
- **Rationale**: The setting and persistence already exist; templates must not carry a
  language preference, and a per-profile localStorage key matches the existing options
  model.
- **Alternatives considered**: Store language in the template (rejected: templates must be
  portable); a main-process config file (rejected: adds IPC/state duplication for no
  benefit); always default to Chinese (rejected by the spec's OS-language behavior).

## D-003: Optional stable message keys for main-process errors

- **Decision**: Keep the existing `message` strings and add optional
  `messageKey`/`messageParams` fields to user-facing IPC error results. The renderer
  translates `messageKey` when present and falls back to `message` otherwise. Cover the
  primary flows first (printing, templates, license, validation) and document remaining
  raw-message fallbacks.
- **Rationale**: Wholesale replacement of every main-process string would be a large IPC
  contract change; additive optional fields keep old payloads valid and make the change
  reversible. The raw `message` remains for logs and untranslated fallbacks.
- **Alternatives considered**: Pass the active language in every IPC payload (invasive and
  easy to forget); translate all main strings immediately (large, unrelated blast radius);
  translate user-visible main errors only by matching Chinese text (fragile).

## D-004: Help scope and translation ownership

- **Decision**: Localize the eight in-app HelpDialog sections and help navigation. The
  detailed parity help corpus is out of scope. English copy is authored by the
  implementation agent (Claude) and reviewed by the owner for product terminology.
- **Rationale**: The in-app HelpDialog is the only help surface shipped in `main`; the
  parity corpus is not packaged and is a much larger content project. Agent-authored copy
  is the owner's explicit choice; terminology review keeps product names consistent.
- **Alternatives considered**: Translate the full parity corpus (rejected for this
  feature's scope; can become a separate content feature); keep help in Chinese (rejected:
  the English UI would be incomplete for the help entry point).

## D-005: Presentation-only localization

- **Decision**: Localization affects UI labels and UI formatting only. Document content,
  data-source values, barcode data, printer commands, print logs and exported file names
  remain language-independent. Date/time and numeric formatting helpers are used only for
  display; data-source parsing stays on the existing canonical rules.
- **Rationale**: The print pipeline and template format are compatibility contracts
  (`003`/`005`); changing them would risk byte-level output and saved files.
- **Evidence**: Protocol goldens and print-executor tests must remain green; the E2E
  scenario compares output before/after a language switch.

## D-006: Catalog parity, fallback and completeness gate

- **Decision**: Both catalogs must contain exactly the same keys. `t()` interpolates named
  parameters, returns the active-language value, and falls back to Chinese (the source
  language) when a key is missing or empty. A test/CI check reports missing keys and empty
  values; missing keys are also logged in development.
- **Rationale**: Prevents blank controls and makes translation completeness measurable
  (SC-002/FR-005/FR-013).
- **Alternatives considered**: Runtime fallback to the key string (rejected: exposes raw
  keys); silently showing the other language without reporting (rejected: hides gaps).

## Open Questions

None blocking. Product terminology in the English catalog is reviewed by the owner after
the first translation pass; remaining terminology changes are copy edits, not design
changes.

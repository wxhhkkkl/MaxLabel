# Quickstart: Bilingual UI (Chinese/English)

**Feature**: `007-i18n` | **Date**: 2026-10-19

## Prerequisites

- Windows 10/11 x64 (primary), Node.js ≥ 22.12.0, `npm install` completed.
- A local printer or a saved template for the print-output comparison.
- No cloud/license server is required for the UI checks.

## Setup

```bash
cd app
npm install
npm run dev
```

Production build: `npm run build`.

## Automated Validation

```bash
cd app
npm test
npm run test:coverage
env -u ELECTRON_RUN_AS_NODE npm run test:e2e
```

Expected planned coverage:

- Unit: catalog key parity, empty-value detection, placeholder parity, interpolation and
  fallback; `normalizeAppOptions` accepts `en-US` and normalizes unknown values to
  `zh-CN`; first-launch language detection.
- Integration: options persistence of the language; IPC `messageKey` resolution and
  raw-message fallback.
- E2E: switch to English, verify the primary shell/menus/dialogs and the eight
  HelpDialog sections, switch back, restart persistence, and compare protocol/template
  output before and after the switch.

## Manual Validation Scenarios

### V-01 Switch to English and complete the core flow

1. Open Options → General → Interface language; select English.
2. Open a new label, add text and a Code128 barcode, open print preview and submit a test
   print.
3. Inspect menus, toolbars, property panels, status bar and validation messages.

Expected: the UI updates without restart; no Chinese-only UI labels or raw keys appear;
the label content and printed output are unchanged.

### V-02 HelpDialog in both languages

1. Open Help → Help Topic in Chinese; inspect all eight sections.
2. Switch to English; reopen Help Topic and inspect the same eight sections.

Expected: section titles, intros, item titles and bodies are translated; no blank items;
the section topology is identical.

### V-03 Persistence and OS default

1. Select English; close and restart the application.
2. With a fresh profile (no saved options), start the application under an English OS
   locale and under a non-Chinese/non-English locale.

Expected: the explicit English choice is restored; the English OS profile starts in
English; any other OS locale falls back to Chinese.

### V-04 Language does not change output

1. Configure a label with a serial source, printer settings and a protocol command set.
2. Generate/print the label in Chinese; switch to English and repeat with the same
   document.

Expected: resolved data, serial values, printer settings, protocol bytes and print-log
snapshots are identical; only UI labels differ.

### V-05 Missing translation and layout quality

1. Temporarily remove/empty a non-critical catalog key (development profile).
2. Open the affected screen in English.
3. Resize the primary dialogs to the supported minimum window size in both languages.

Expected: the Chinese fallback (not a blank control or raw key) is shown and the missing
key is reported; primary actions remain visible and do not overlap.

## Validation Results (2026-10-19)

- `npm test`: 56 test files / 414 tests passed (typecheck node/web/test + Vitest).
- `npm run test:coverage`: statements 81.23%, branches 67.18%, functions 88.57%,
  lines 86.62% (`shared/domain` lines 88.41%, `shared/print` lines 84.54%; the 80% line
  gate passes).
- `env -u ELECTRON_RUN_AS_NODE npm run test:e2e`: 13 Playwright Electron tests passed,
  including five i18n scenarios (switch/persist, English layout at minimum size, unchanged
  document and print settings, first-launch OS detection, English print preview).
- V-01 (core flow, English UI): covered by the E2E language switch plus the English print
  dialog; no CJK text remains in the print dialog.
- V-02 (HelpDialog): all eight sections render in both languages (E2E asserts the section
  count and the English section title).
- V-03 (persistence and OS default): restart persistence and OS-language detection are
  covered by E2E; non-Chinese/non-English locales fall back to Chinese (unit + E2E).
- V-04 (output unchanged): the opened template file is compared byte-for-byte before and
  after switching languages; resolved data, printer settings and protocol builders do not
  read the UI language.
- V-05 (missing translation and layout): missing/empty-key fallback is covered by unit and
  completeness tests; the English Options/Help dialogs fit the supported minimum size.
- Owner terminology review of the agent-authored English copy: **pending** (owner action).
- Physical printer output was not exercised in this environment (no printer attached); the
  print pipeline and protocol goldens are unchanged by design.

## Convergence Validation (2026-10-19)

- `npm test`: 57 files / 418 tests passed, including the new
  `tests/unit/shared/i18n/catalog-coverage.test.ts` gate.
- `npm run test:coverage`: unchanged at 86.62% lines (domain 88.41%, print 84.54%).
- `env -u ELECTRON_RUN_AS_NODE npm run test:e2e`: 14 Playwright tests passed (6 i18n).
- T037–T044 closed: primary property/option catalogs, secondary dialogs, editor chrome,
  license IPC message keys, minimum-window layout checks (print / printer settings /
  object properties) and StartPage promotional copy.
- The lookup-catalog exception (source-text keys) is recorded in
  [contracts/i18n-messages.md](./contracts/i18n-messages.md) with the coverage gate that
  enforces it.
- Remaining manual item: owner terminology review (T035).

## Phase 8 Convergence Validation (2026-10-19)

- `npm test`: 57 files / 421 tests passed.
- `npm run test:coverage`: unchanged at 86.62% lines (domain 88.41%, print 84.54%).
- `env -u ELECTRON_RUN_AS_NODE npm run test:e2e`: 14 Playwright tests passed.
- Closed T045–T052: barcode data tab/symbology/spec catalog, language-aware editor and
  data-management statuses, localized import/print/render errors at the UI boundary,
  cloud/db IPC message keys, canonical cloud category metadata, locale-formatted dates,
  translated StartPage articles, and the extended renderer-wide coverage gate
  (dotted-key references, raw-status scan, lookup catalogs and barcode labels).
- Only T035 (owner terminology review + physical printer check) remains manual.

## Phase 12 Convergence Validation (2026-10-19)

- `npm test`: 58 files / 426 tests passed.
- `npm run test:coverage`: 86.64% lines.
- `env -u ELECTRON_RUN_AS_NODE npm run test:e2e`: 14 Playwright tests passed.
- Closed T064: the barcode-export failure path now carries `messageKey: 'error.export'`.
- Only T035 (owner terminology review + physical printer check) remains manual.

## Phase 11 Convergence Validation (2026-10-19)

- `npm test`: 58 files / 426 tests passed.
- `npm run test:coverage`: 86.64% lines.
- `env -u ELECTRON_RUN_AS_NODE npm run test:e2e`: 14 Playwright tests passed.
- Closed T062–T063: remaining shared-template/log/cloud/image/template-library and print
  messages carry message keys or are translated at the main boundary, and print-history
  table counts use locale formatting.
- Only T035 (owner terminology review + physical printer check) remains manual.

## Phase 12 Convergence Validation (2026-10-19)

- `npm test`: 58 files / 426 tests passed.
- `npm run test:coverage`: 86.64% lines.
- `env -u ELECTRON_RUN_AS_NODE npm run test:e2e`: 14 Playwright tests passed.
- Closed T064: the barcode-export failure path now carries `messageKey: 'error.export'`.
- Only T035 (owner terminology review + physical printer check) remains manual.

## Phase 9 Convergence Validation (2026-10-19)

- `npm test`: 58 files / 424 tests passed.
- `npm run test:coverage`: unchanged at 86.62% lines.
- `env -u ELECTRON_RUN_AS_NODE npm run test:e2e`: 14 Playwright tests passed.
- Closed T053–T058: OptionsDialog Row/Group/ExtGroup, PropertyPanel field hints,
  DataPanel ODBC hints, CloudDialog defaults, remaining IPC message keys, and the error
  catalog coverage test. The coverage gate now also rejects unwrapped Chinese JSX text
  nodes and verifies every thrown import/print/render error is in the error catalog.

## Phase 10 Convergence Validation (2026-10-19)

- `npm test`: 58 files / 426 tests passed.
- `npm run test:coverage`: 86.64% lines.
- `env -u ELECTRON_RUN_AS_NODE npm run test:e2e`: 14 Playwright tests passed.
- Closed T059–T061: language-aware window title, localized native file/save/confirm
  dialogs and cloud window title (language passed through IPC), and locale-formatted
  numeric counts in data/template/cloud/history views.
- Only T035 (owner terminology review + physical printer check) remains manual.

## Phase 12 Convergence Validation (2026-10-19)

- `npm test`: 58 files / 426 tests passed.
- `npm run test:coverage`: 86.64% lines.
- `env -u ELECTRON_RUN_AS_NODE npm run test:e2e`: 14 Playwright tests passed.
- Closed T064: the barcode-export failure path now carries `messageKey: 'error.export'`.
- Only T035 (owner terminology review + physical printer check) remains manual.

## Phase 11 Convergence Validation (2026-10-19)

- `npm test`: 58 files / 426 tests passed.
- `npm run test:coverage`: 86.64% lines.
- `env -u ELECTRON_RUN_AS_NODE npm run test:e2e`: 14 Playwright tests passed.
- Closed T062–T063: remaining shared-template/log/cloud/image/template-library and print
  messages carry message keys or are translated at the main boundary, and print-history
  table counts use locale formatting.
- Only T035 (owner terminology review + physical printer check) remains manual.

## Phase 12 Convergence Validation (2026-10-19)

- `npm test`: 58 files / 426 tests passed.
- `npm run test:coverage`: 86.64% lines.
- `env -u ELECTRON_RUN_AS_NODE npm run test:e2e`: 14 Playwright tests passed.
- Closed T064: the barcode-export failure path now carries `messageKey: 'error.export'`.
- Only T035 (owner terminology review + physical printer check) remains manual.

## Out of Scope

- Translation of user-authored template content, barcode data, printer commands, print
  logs or exported file names.
- The parity-only detailed LabelShop help corpus (156 HTML articles).
- Languages other than Chinese and English; right-to-left layouts.

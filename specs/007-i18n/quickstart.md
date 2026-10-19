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

## Out of Scope

- Translation of user-authored template content, barcode data, printer commands, print
  logs or exported file names.
- The parity-only detailed LabelShop help corpus (156 HTML articles).
- Languages other than Chinese and English; right-to-left layouts.

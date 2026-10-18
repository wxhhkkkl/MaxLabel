# Quickstart: MaxLabel Desktop System Baseline

**Feature**: `001-system-baseline` | **Date**: 2026-10-18

This guide validates the as-is behavior described in `spec.md`. The automated regression
suite has been restored from `parity` and `npm test` passes; the manual scenarios below
remain the reference for behavior that needs a GUI, real printers or operator judgement.

## Prerequisites

- Windows 10/11 x64
- Node.js ≥ 22.12.0
- A local Windows printer (driver printing) or a reachable printer/port (native commands)
- No cloud server or license server is required for local editing

## Setup

```bash
cd app
npm install
npm run typecheck
npm run dev
```

Production build:

```bash
npm run build
```

Expected: the Electron window opens with the start page and the editor shell; type checking
and the production build complete without errors.

### Test environment notes

- `npm test` runs type checking, protocol/unit regressions, the Electron render regression
  and the workspace regression.
- If `ELECTRON_RUN_AS_NODE=1` is set in the environment, the Electron-based tests fail to
  start. Run them with the variable unset, for example in Git Bash:
  `env -u ELECTRON_RUN_AS_NODE npm test`.
- `app/fixtures/protocol/**` is compared byte-for-byte. `.gitattributes` marks it `-text`
  so Git does not convert LF to CRLF. If an older checkout already converted it, run
  `npm run fixtures:print` to regenerate the fixtures and snapshot.

## Validation Scenarios

### V-01 Design and preview a label (US1)

1. Create a new 80×60 mm label.
2. Add a text object and a Code128 barcode; enter content.
3. Move, resize and rotate the objects; optionally add an image and a table.
4. Open print preview.

Expected: the canvas uses millimetre coordinates; the preview matches the canvas content.

### V-02 Batch variable data (US2)

1. Import a CSV with 10 rows and bind a text object to a field.
2. Configure a serial source with start 1, step 1, digits 4.
3. Set print count to 10 and open preview.
4. Add a date/time source, a keyboard-input source with a custom order, and a formatted
   text object; verify their preview values.

Expected: 10 preview labels use rows in order; serial values are 0001, 0002, …;
keyboard prompts follow the configured order; formatting/substring is applied.

### V-03 Multi-document and templates (US3)

1. Open two documents in separate tabs; edit and undo in one.
2. Save one template as `.msdx`; reopen it.
3. Try to save to the path already open in the other tab.
4. Export a barcode image as PNG with a prefix and content+serial naming.

Expected: undo affects only the active document; the saved template reopens with content
and printer settings; the duplicate-path save is rejected; exported file names follow the
selected rule and the directory contains the expected images.

### V-04 Native printing (US4)

1. List printers and confirm the default printer and port are shown.
2. Print through the Windows driver.
3. Select a Zebra printer and print via ZPL; select a TSC printer and print via TSPL.
4. Add an ellipse or rotated text that cannot be expressed natively and print again.
5. Save the template with non-default printer settings and reopen it.

Expected: driver and native paths produce output; unsupported primitives fall back to a
page bitmap; if the bitmap is not ready printing is blocked with a message; printer
settings are restored.

### V-05 License and offline editing (US5)

1. With no license configured, create and save a local template.
2. Check the license status page.
3. If a test license server is available, activate a key and re-check status.
4. Simulate an unreachable server (stop it or use an invalid URL) and restart.

Expected: local editing and saving are never blocked; activation binds the current machine;
an unreachable server does not clear a cached valid license.

## Explicitly Not Verified Here

- Cloud template CRUD against a live server (server is being rewritten).
- Cloud database endpoints (`/api/cloud/databases*`) — no current server implementation.
- Update check against `/api/version` — no current server implementation.
- Real hardware behavior for every printer brand/model.

## Restored Test Harness

The previous suite was restored from `parity` (`546f151`) on 2026-10-18 and passes against
the current source. It contains:
`app/scripts/print-engine.test.ts`, `editor-operations.test.ts`, `render-regression.*`,
`workspace-regression.cjs`, `protocol` fixtures and the protocol snapshot JSON.

Next step: convert the manual scenarios above into automated regression tests where
practical (especially the multi-document and license cases), following the constitution's
TDD order.

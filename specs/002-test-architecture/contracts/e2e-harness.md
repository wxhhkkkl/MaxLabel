# Contract: Playwright Electron Harness

**Feature**: `002-test-architecture` | **Date**: 2026-10-18

## Launch

1. Run `npm run build`; require `app/out/main/index.js` to exist.
2. Launch with Playwright `_electron.launch`:
   - `cwd`: `app/`
   - `args`: `['.']` (Electron reads `package.json.main`)
   - `executablePath`: resolved from the `electron` package (CJS `require('electron')`)
3. Environment:
   - Copy `process.env` and **delete `ELECTRON_RUN_AS_NODE`**.
   - Set `MAXLABEL_OPEN_PATH` / `MAXLABEL_PICK_PATH` only for tests that need them.
   - Do not set a cloud server URL for the offline-license journey.
4. Isolation: pass a unique `--user-data-dir=<temp dir>` per test. This isolates license
   cache, app config, path grants, template library, print logs and Chromium storage.
5. Wait for `[data-testid="start-page"]` on the first window. A fresh profile shows the
   GetStarted modal; dismiss it explicitly or seed `maxlabel.firstRun`.

## Teardown

- The app's main-window close guard prevents normal quit. Do not rely on
  `electronApp.close()` alone.
- Preferred teardown:
  1. `electronApp.evaluate(({ app }) => app.exit(0))`
  2. Race against a timeout
  3. Force-kill the process/tree on Windows if still alive
- Remove the temporary userData directory after the process exits.

## Artifacts

- Screenshot on failure.
- Trace with `retain-on-failure`.
- Video is optional; verify support in the P0 spike. If unsupported, rely on screenshots
  and the trace action log.
- Report retries separately from deterministic failures.

## Journeys

| ID | Steps | Assertions |
|----|-------|------------|
| `launch` | Launch app, dismiss first-run modal | Start page and editor shell visible |
| `template-roundtrip` | Open a `.msdx` via `MAXLABEL_OPEN_PATH`, edit, save | File parses; content equals the normalized document |
| `print-preview` | Open fixture, click `打印预览`, wait for second window | Preview shows 1/1 page and a non-zero image; close it |
| `offline-license` | Fresh profile, no server URL, launch and edit | Editing/saving not blocked; no external network required |

## Prohibited

- Driving native file dialogs directly; use the env hooks or patch the main-process dialog.
- Clicking the preview's print button (would contact a real printer).
- Sharing a userData directory between tests.
- Adding product-only test hooks without owner approval.

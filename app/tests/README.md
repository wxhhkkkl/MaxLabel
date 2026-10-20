# MaxLabel tests

The new test architecture uses **Vitest** for unit/contract/integration tests and
**Playwright Electron** for a few critical desktop journeys. See
`specs/002-test-architecture/` for the specification, plan and task backlog.

ESC/POS coverage lives in `tests/unit/shared/print/escpos*.test.ts`,
`tests/unit/shared/domain/printer-escpos.test.ts`,
`tests/contracts/escpos-golden.test.ts` and
`tests/integration/renderer/print-executor-escpos.test.ts`.

Electronic-scale coverage lives in `tests/unit/shared/scale/` (protocol parsing, units,
per-label resolution), `tests/unit/renderer/scale/auto-print.test.ts` (stable reading →
one logical label), `tests/contracts/scale-ipc.test.ts`,
`tests/integration/main/scale.test.ts` (serial lifecycle with a scripted transport),
`tests/integration/renderer/scale-print.test.ts` (weights in the print executor) and
`tests/e2e/scale.spec.ts` (simulated preview, disconnect error, auto-print control). The
simulator is selected only by `MAXLABEL_SCALE_SIM`; real-device checks are deferred and
listed in `specs/008-electronic-scale/quickstart.md`.

Label-format coverage lives in `tests/unit/renderer/label-formats-{media,catalog}.test.ts`
(media classification and catalog queries), `tests/unit/renderer/custom-label-format.test.ts`
and `tests/unit/shared/domain/paper.test.ts` (custom size and paper geometry),
`tests/unit/renderer/{template-props-geometry,label-format-entry-points}.test.ts`
(preset read-only and entry points), `tests/unit/renderer/{preview-annotation,label-preview-geometry}.test.ts`
(annotation sizing and roll/sheet preview), `tests/integration/renderer/new-label-mapping.test.ts`
and the E2E specs `new-label-format`, `custom-label-format` and `template-props-geometry`.

Editor-shell coverage lives in `tests/unit/renderer/editor-{menus,availability,shortcuts}.test.ts`
(menu structure, command availability, shortcuts and the editable-target guard),
`tests/unit/renderer/{toolbar-layout,app-options,view-preferences,fit-zoom}.test.ts`
(toolbar layout/key bindings, AppOptions persistence, themes, fit zoom),
`tests/unit/shared/{app-title,mfc-caption}.test.ts` (window title and `&` accelerators) and
`tests/e2e/editor-shell.spec.ts` (menus, toolbar persistence, view/theme/fit/rotation, tabs,
title and object-property captions).

Cross-platform transport coverage lives in `tests/unit/main/transport-adapter.test.ts`,
`tests/unit/main/build-targets.test.ts` and
`tests/integration/main/unix-transport.test.ts`. These use injected doubles for
`execFile`, `serialport` and `usb`; real device behavior is recorded in
`specs/005-cross-platform/verification/hardware-matrix.md`.

Vector driver coverage lives in `tests/contracts/driver-svg-validation.test.ts`,
`tests/unit/main/driver-print-html.test.ts`,
`tests/unit/shared/print/driver-page-svg.test.ts`,
`tests/integration/renderer/print-executor.test.ts` and the hidden Chromium
`tests/e2e/vector-render.spec.ts`. The harness rasterizes Fabric SVG pages and checks
vector text/paths, barcode SVG, the paper clip and the raster fallback.

Bilingual UI coverage lives in `tests/unit/shared/i18n/`,
`tests/unit/renderer/options-i18n.test.ts`,
`tests/unit/renderer/i18n-format.test.ts`,
`tests/contracts/i18n-ipc-errors.test.ts`,
`tests/integration/renderer/i18n-errors.test.ts` and `tests/e2e/i18n.spec.ts`. The E2E
spec switches languages, checks the shell/HelpDialog and the English print preview,
verifies first-launch OS detection, persistence and layout, and confirms the
document/template is unchanged.

## Layers

| Layer | Directory | Runtime | Gate |
|-------|-----------|---------|------|
| unit | `tests/unit/` | Node (jsdom only for DOM-light cases) | `npm test` |
| contracts | `tests/contracts/` | Node / jsdom (LSDX) | `npm test` |
| integration | `tests/integration/` | Node with mocks + temp dirs | `npm test` |
| e2e | `tests/e2e/` | Playwright + built Electron app | `test:e2e` |
| release tooling | `app/scripts/` | build/generator/installer tools only | `test:release` / manual |

The fast gate must not import `electron`, `net`, `child_process`, `app/scripts`,
`parity/` or `app/docs`. Integration tests use controlled substitutes and OS temp dirs.

## Commands

```bash
npm test                  # typecheck + typecheck:test + Vitest (unit/contracts/integration)
npm run test:unit
npm run test:contracts
npm run test:integration
npm run test:coverage     # v8 coverage, 80% lines for shared/domain + shared/print
npm run test:e2e          # builds the app, then Playwright
npm run test:e2e:headed   # local debugging
npm run test:spike        # Playwright Electron launch/teardown probe
npm run test:e2e          # includes the renderer and workspace harness specs
```

Environment caveats:

- Electron-based tests require `ELECTRON_RUN_AS_NODE` to be unset:
  `env -u ELECTRON_RUN_AS_NODE npm run test:e2e`.
- `app/fixtures/protocol/**` is byte-exact and protected by `.gitattributes -text`.
  If a checkout converted it to CRLF, run `npm run fixtures:print`.
- `out/` must exist for E2E; `test:e2e` builds first.

## Adding a test

1. Pick the lowest layer that can prove the behavior.
2. Use explicit Vitest imports: `import { describe, it, expect, vi } from 'vitest'`.
3. Import source through the aliases: `@shared/...`, `@main/...`, `@/...`.
4. Use `tests/helpers/factories.ts` for documents/printers/contexts and
   `tests/helpers/tempDir.ts` for filesystem work.
5. Write the failing assertion first where practical; confirm it fails for the right
   reason, then implement or wire the behavior.
6. Mutation check: temporarily break the covered branch and confirm the test fails,
   then revert.

## E2E debugging

- `npx playwright test tests/e2e/print-preview.spec.ts --reporter=list`
- `npx playwright test --headed`
- Failure artifacts: `app/test-results/` (trace) and `app/playwright-report/`.
- The fixture (`tests/e2e/fixtures/electron-app.ts`) isolates each run with its own
  `--user-data-dir` and bounded `app.exit(0)` teardown.
- Native dialogs are bypassed with `MAXLABEL_OPEN_PATH` (open) and the template save
  path flow; do not try to drive OS dialogs.
- Never click the preview's print button; it contacts a real printer.

## Goldens

`app/fixtures/protocol/**` is generated by `npm run fixtures:print`. After changing a
generator or protocol output, review the byte diff and the manifest, then run the golden
contract tests. Do not normalize line endings for these files.

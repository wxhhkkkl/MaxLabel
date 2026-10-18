# Quickstart: Test Architecture Rebuild

**Feature**: `002-test-architecture` | **Date**: 2026-10-18

This guide describes the target workflow. It becomes executable as the implementation
phases land; the P0 spike is the first gate.

## Prerequisites

- Windows 10/11 x64
- Node.js ≥ 22.12.0
- `cd app && npm install`
- No printer, cloud server or LabelShop installation is required

## Phase 0: Playwright Electron spike (must pass first)

After the infrastructure phase:

```bash
cd app
npm run test:spike
```

The spike must:

1. Launch Electron 44.3.0 through Playwright `_electron`.
2. Open the first window and capture a screenshot.
3. Exit within the timeout using `app.exit(0)` plus a bounded force-kill.
4. Prove that a temporary `--user-data-dir` is used.

If the spike fails, stop and re-plan; do not build journeys on an incompatible base.

## Fast Suite

```bash
cd app
npm test              # typecheck + typecheck:test + Vitest unit/contracts/integration
npm run test:unit
npm run test:integration
npm run test:coverage
```

Expected:

- All commands exit 0.
- `npm test` completes in under 2 minutes.
- Coverage is reported for `src/shared/domain/**` and `src/shared/print/**`; generated
  files are excluded and the 80% line threshold is enforced (confirm/raise later).

## E2E Suite

```bash
cd app
npm run test:e2e
```

Expected:

- The app is built first.
- Four journeys pass: launch, template roundtrip, print preview, offline license.
- No real printer or network service is contacted.
- On failure, screenshots/traces are written to `app/test-results/` and
  `app/playwright-report/`.
- Each test uses its own temporary userData directory.

## Legacy Oracle

```bash
cd app
npm run test:legacy
```

Expected: the legacy suite remains green while the new suite is being built. It is not a
merge gate during the transition and must not receive new tests.

## Troubleshooting

| Symptom | Cause / action |
|---------|----------------|
| Electron starts as Node or E2E hangs at launch | `ELECTRON_RUN_AS_NODE=1` is set; delete it in the environment/fixture |
| `electron` binary missing | Re-run `npm install` or set `ELECTRON_MIRROR` / `ELECTRON_GET_USE_PROXY` |
| Playwright `close()` hangs | The main-window close guard blocks quit; use `app.exit(0)` + bounded force-kill |
| `Path2D is not defined` under jsdom | Rendering/fabric tests belong in Electron E2E, not jsdom |
| Protocol byte-count mismatch | CRLF conversion; ensure `.gitattributes -text` and regenerate goldens |
| Test sees stale app code | `out/` is stale; run `npm run build` before E2E |
| First-run modal blocks assertions | Dismiss `[data-testid="get-started-dialog"]` or seed `maxlabel.firstRun` |

## Validation Checklist

- [ ] P0 spike passes on Electron 44.3.0 / Playwright 1.64.1.
- [ ] `npm test` < 2 minutes and is the merge gate.
- [ ] Unit/contract/integration projects have distinct configs and runtimes.
- [ ] No fast-gate test depends on `parity/`, `app/docs`, real printers, network or cloud.
- [ ] Coverage thresholds are enforced and visible in CI.
- [ ] Four E2E journeys pass with isolated userData and artifacts on failure.
- [ ] Legacy assertion inventory is complete; every P1 behavior maps to a new test or an
      approved retirement.
- [ ] The legacy suite is removed in one reversible change.
- [ ] The testing guide and behavior-to-test index are published.

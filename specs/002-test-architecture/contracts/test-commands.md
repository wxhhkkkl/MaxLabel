# Contract: Test Commands and CI Jobs

**Feature**: `002-test-architecture` | **Date**: 2026-10-18

## npm Scripts

| Command | Runs | Gate | Budget |
|---------|------|------|--------|
| `npm test` | `typecheck` + `typecheck:test` + Vitest unit/contracts/integration | Blocking fast gate | < 2 min |
| `npm run test:unit` | Vitest `unit` project | Subset of fast gate | — |
| `npm run test:integration` | Vitest `integration` project | Subset of fast gate | < 60 s |
| `npm run test:coverage` | Vitest fast suite + v8 coverage thresholds | CI fast job | — |
| `npm run test:e2e` | `npm run build` + Playwright Electron | Separate blocking E2E job | ~20 min job |
| `npm run test:e2e:headed` | Same, headed (local debugging) | Opt-in | — |
| `npm run test:legacy` | Current esbuild/Electron suite | Non-blocking transition job | — |
| `npm run test:release` | Installer/NSIS verification | Manual/release only | — |

Rules:

- `npm test` MUST return non-zero on any failure and MUST print a standard runner summary.
- `npm test` MUST NOT require Electron, a display, a printer, network or `parity/`.
- `test:e2e` MUST build first; a missing/stale `out/` is an error, not a silent skip.
- `test:legacy` remains runnable until the assertion inventory is complete; it is not part
  of the merge gate during the transition.
- New tests MUST NOT be added to `test:legacy`/`app/scripts`.

## CI Jobs

| Job | Runner | Commands | Artifacts | Blocking |
|-----|--------|----------|-----------|----------|
| `fast` | windows-latest | `npm ci`, `npm audit`, `npm run typecheck`, `npm run typecheck:test`, `npm run test:coverage`, `npm run build` | `app/coverage/**` | Yes |
| `e2e` | windows-latest | `npm ci`, `npm run test:e2e` | `app/playwright-report/**`, `app/test-results/**` | Yes (for covered journeys) |
| `legacy` | windows-latest | `npm ci`, `npm run test:legacy` | logs | No (transition only) |
| `release` | windows-latest | installer/build verification | installer artifacts | Manual/release |

Requirements:

- Cache npm and Electron downloads; set `timeout-minutes` on each job.
- Upload E2E screenshots/traces on failure.
- Report the fast suite's measured runtime; fail if it exceeds the agreed budget.
- Do not lower `npm audit --audit-level=moderate` to accommodate new dependencies without
  an explicit owner decision.

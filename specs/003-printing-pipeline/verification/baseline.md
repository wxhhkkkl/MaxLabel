# Printing Pipeline — Verification Baseline

**Feature**: `003-printing-pipeline` | **Date**: 2026-10-18 | **Commit**: `00bb6e1`

## Automated Results

| Command | Result |
|---------|--------|
| `npx vitest run --project unit tests/unit/shared/print` | 6 files / 38 tests passed |
| `npx vitest run --project contracts tests/contracts/protocol-golden.test.ts` | 1 file / 4 tests passed |
| `npx vitest run --project integration tests/integration/main/printing-transport.test.ts tests/integration/renderer/print-executor.test.ts` | 2 files / 17 tests passed |
| `npx playwright test tests/e2e/print-preview.spec.ts tests/e2e/render-harness.spec.ts` | 2 tests passed (10.8 s) |

## Full Gate Reference

| Command | Result |
|---------|--------|
| `npm test` | 37 files / 330 tests passed |
| `npm run test:coverage` | Lines 85.23%, statements 79.82%, functions 87.46%, branches 64.78% |
| `npm run test:e2e` | 7 specs passed (33.7 s) |

Environment: Windows 11, Node 24.14.1 (local; CI uses 22.12.0), Electron 44.3.0,
`ELECTRON_RUN_AS_NODE` unset for Electron tests.

## Notes

- Automated tests use controlled substitutes for drivers/printers; real-device output is
  recorded separately in `hardware-matrix.md`.
- The 003 working tree is documentation-only; the commit above is the last code commit.

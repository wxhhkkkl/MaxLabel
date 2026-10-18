# Implementation Plan: Test Architecture Rebuild

**Branch**: `002-test-architecture` | **Date**: 2026-10-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-test-architecture/spec.md`

## Summary

Replace the legacy, heterogeneous test suite with a layered architecture: Vitest for
unit, contract and integration tests, and Playwright Electron for four critical desktop
journeys plus renderer/workspace harnesses. The owner selected a full rewrite
(2026-10-18); the legacy suite was used as an oracle and removed on 2026-10-18 after every
P1 assertion was ported or explicitly mapped.

The fast suite (`npm test`) becomes the merge gate and must finish in under two minutes.
E2E and release/installer verification run as separate CI jobs. No product behavior may
change as part of this feature; defects found during the rewrite are recorded and fixed
separately.

## Technical Context

**Language/Version**: TypeScript 5.9.3; Node.js ≥ 22.12.0; package remains CommonJS
(no `"type": "module"`; Electron main/preload stay CJS)

**Primary Dependencies**: Vitest 5.0.5, `@vitest/coverage-v8` 5.0.5,
`@playwright/test` 1.64.1 (Electron `_electron`), jsdom 26.1 (only for DOM-light tests),
`@types/node` ^22; existing Vite 7.3.6, Electron 44.3.0, electron-vite 5.0.0

**Storage**: N/A for the test architecture itself; tests use OS temporary directories and
must not write to the repository or the developer's real Electron userData

**Testing**: Vitest fast suite (unit / contracts / integration) + Playwright Electron
(four journeys + renderer/workspace harnesses); the legacy suite was removed after full
port on 2026-10-18

**Target Platform**: Windows 10/11 x64; CI `windows-latest`; Linux not a product target

**Project Type**: Desktop application (Electron)

**Performance Goals**: `npm test` < 2 minutes; E2E `workers: 1`, per-test timeout 60 s,
job budget ~20 minutes; dependency installation dominates CI, so Electron and npm caches
are required

**Constraints**: No product behavior changes; no product-only test hooks without owner
approval; no dependency on `parity/` or `app/docs`; jsdom cannot render fabric/`Path2D`,
so pixel/rendering tests stay in Electron; protocol goldens are byte-exact; the local
shell may set `ELECTRON_RUN_AS_NODE=1`

**Scale/Scope**: 31 legacy script files (~4,500 lines), 19 files in the current gate,
4 E2E journeys, 15 domain areas, 80% line coverage target for `shared/domain` and
`shared/print`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status | Notes |
|-----------|------|--------|-------|
| I. 测试先行（TDD） | New behavior must have a failing test first | PASS | The legacy harness was restored on 2026-10-18 and `npm test` passes; new tests are written before implementation. |
| II. 先澄清，不猜测 | Ambiguous scope/contracts must be clarified | PASS | Owner confirmed Vitest, Playwright Electron and full rewrite on 2026-10-18. Open product questions remain in spec 001. |
| III. 巨大架构变更先确认 | Architecture-level changes need explicit approval | PASS | This is an architecture-level change; the owner selected the approach and the full-rewrite strategy. |
| Evidence rule | Every claim traces to code/tests/commits | PASS | Decisions below cite the legacy files and the two exploration reports. |

**Post-design re-check**: unchanged. The plan introduces no product behavior changes; the
main risk is the experimental Playwright Electron integration, handled by a P0 spike.

## Project Structure

### Documentation (this feature)

```text
specs/002-test-architecture/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── test-commands.md      # npm scripts, CI jobs and gate membership
│   ├── fixtures.md           # golden/fixture policy and update procedure
│   └── e2e-harness.md        # Electron launch/teardown/isolation contract
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
app/
├── vitest.config.ts             # fast projects: unit, contracts, integration
├── playwright.config.ts         # E2E project
├── tsconfig.test.json           # type checking for tests/configs
├── tests/
│   ├── unit/                    # pure domain/print/renderer logic (node)
│   ├── contracts/               # IPC, template format, goldens (node/jsdom)
│   ├── integration/             # main-boundary + renderer workflows (mocks)
│   ├── e2e/                     # Playwright Electron journeys
│   ├── helpers/                 # temp dirs, electron mock, factories
│   └── fixtures/                # new fixtures (protocol/lsdx stay in app/fixtures)
├── fixtures/                    # existing protocol goldens + minimal.lsdx
├── scripts/                     # build/generator/installer tooling only
└── src/                         # unchanged product source
```

**Structure Decision**: Tests live in a top-level `app/tests/` tree. Unit/contract/
integration tests run in Node or jsdom; anything that needs real Chromium, fabric,
`Path2D`, window geometry or IPC goes to Playwright Electron. The legacy suite was
removed after the equivalence inventory reached 100%.

### Test Project Matrix

| Project | Runner | Environment | Includes | Gate |
|---------|--------|-------------|----------|------|
| unit | Vitest | node | `tests/unit/**/*.test.ts` | `npm test` |
| contracts | Vitest | node (jsdom for LSDX/DOMParser) | `tests/contracts/**/*.test.ts` | `npm test` |
| integration | Vitest | node + mocks/temp dirs | `tests/integration/**/*.test.ts` | `npm test` |
| e2e | Playwright | Electron (built app) | `tests/e2e/*.spec.ts` | `test:e2e` |
| legacy | — | — | removed 2026-10-18 after full port | — |
| release | node | as today | installer tests | release job |

## Key Decisions and Rationale

1. **Vitest 5.0.5 with Vite 7** — reuses the existing Vite/TypeScript toolchain, runs TS
   directly, removes the esbuild bundle-to-temp-file pattern, and provides v8 coverage.
   Pin the version because Vitest 5 requires Node 22.12+/Vite 6.4+ and an `@types/node`
   major that matches the runtime.
2. **Playwright 1.64.1 Electron with the built app** — launch `out/main/index.js` via
   `_electron.launch({ args: ['.'] })`, one hidden window per journey, isolated
   `--user-data-dir`, and bounded teardown (`app.exit(0)` then force-kill). P0 spike
   required before building the full E2E suite because `_electron` is experimental.
3. **Full rewrite with a legacy oracle** — the owner chose full rewrite over incremental
   migration. The legacy suite stayed runnable until every P1 assertion was ported, then
   was deleted in one reversible change (2026-10-18).
4. **jsdom only for DOM-light code** — LSDX parsing (`DOMParser`), localStorage logic and
   React logic can run under jsdom. `renderLabel`, fabric canvases, barcode pixels and
   workspace geometry cannot: jsdom lacks `Path2D`, and node-canvas does not provide it.
   These stay in Electron E2E.
5. **Contract tests at the boundaries** — IPC channel names/payloads, template envelope,
   protocol goldens and `.lsdx` import are tested directly against shared modules rather
   than through the UI.
6. **Integration tests with controlled substitutes** — mock `electron`, `fs/promises`,
   `child_process`, `renderLabel` and `bitmapSource`; prefer real temporary directories
   over mocking `fs`; keep a Windows-only real-PowerShell case for the ODBC bridge.
7. **Gate separation** — `npm test` is the fast merge gate; `test:e2e` is a separate job;
   installer/release tests are opt-in; the legacy transition job was removed on
   2026-10-18.
8. **Golden files stay byte-exact** — `app/fixtures/protocol/**` remains `-text`; tests
   read `Buffer` and compare length + SHA-256 + required tokens. The generator remains the
   only way to update goldens.
9. **Coverage limited to core modules** — `shared/domain/**` and `shared/print/**`,
   excluding generated files and re-export-only modules. Start at 80% lines, then decide
   whether to raise it.
10. **No `"type": "module"`** — changing the package format would alter electron-vite
    output and break the legacy `require()`-based suite. Vitest and Playwright work in a
    CJS package.

## Implementation Phases

1. **Infrastructure (P0)** — add Vitest, coverage, Playwright and `@types/node ^22`;
   create `vitest.config.ts`, `playwright.config.ts`, `tsconfig.test.json`; add
   `test:unit`, `test:integration`, `test:coverage`, `test:e2e`; the legacy gate was
   used during the transition and removed after the port. Add `.gitignore` entries for
   coverage/test artifacts.
2. **Playwright spike (P0 gate)** — launch the built Electron app, capture a screenshot,
   force-exit within a timeout, verify isolated userData. If `_electron` is incompatible
   with Electron 44.3.0, stop and re-plan before writing E2E journeys.
3. **Unit ports** — port pure suites in this order: print scene/plan/protocol, script
   runtime/data sources, document model/migration, editor operations/geometry/history,
   barcode/colour/catalog/format/title/close guard.
4. **Contract ports** — IPC contract, template format, `.lsdx` import (jsdom), protocol
   goldens.
5. **Integration ports** — license, cloud, template IPC/path access, database bridge,
   command transport, print executor, data management; add Windows-only PowerShell case.
6. **E2E journeys** — launch/start page, open/save roundtrip, print preview, offline
   license; port the geometry/raster coverage from the old Electron harnesses only where
   Playwright can reproduce it.
7. **CI and documentation** — split fast/E2E jobs, add coverage and failure artifacts,
   write the testing guide and behavior-to-test index, complete the legacy assertion
   inventory, then remove the legacy suite in one reversible change.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Playwright `_electron` incompatibility with Electron 44 | P0 spike before building journeys; exact version pin; fallback to a thin Electron CDP harness |
| `ELECTRON_RUN_AS_NODE=1` in the environment | Delete it in the E2E fixture; document `env -u ELECTRON_RUN_AS_NODE` |
| Playwright `close()` hangs due to the main-window close guard | Bounded teardown: `app.exit(0)`, timeout, force-kill on Windows |
| jsdom cannot render fabric/Path2D | Keep rendering/raster/geometry tests in Electron; do not fake `Path2D` |
| Legacy assertions lost during full rewrite | Assertion inventory + one-line mapping to new tests or approved retirement |
| Fast suite exceeds 2 minutes | Keep PowerShell/DB/Electron out of the fast gate; use workers and test isolation; measure in CI |
| `npm audit` fails on new dependency trees | Check before merging; resolve deliberately rather than lowering the gate |
| Coverage thresholds meaningless due to generated files | Restrict coverage include/exclude explicitly and verify `coverage.all` semantics |
| E2E pollution between tests | One `--user-data-dir` per test; explicit first-run policy; never use the developer profile |
| Native dialogs unavailable to Playwright | Use existing `MAXLABEL_OPEN_PATH`/`MAXLABEL_PICK_PATH`; patch `dialog.showSaveDialog` in the main process |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Full rewrite instead of incremental migration | Owner decision; removes the heterogeneous harness in one coherent architecture | Incremental migration preserves more continuity but leaves two harnesses indefinitely; the oracle + inventory mitigates the rewrite risk |
| Two runners (Vitest + Playwright) | Chromium/fabric/pixel behavior cannot be tested in jsdom | A single Node runner would drop rendering and workspace coverage |
| Legacy suite kept during rewrite | Avoids a coverage gap and provides an equivalence oracle | Deleting first would leave high-risk print/persistence code unguarded |
| jsdom project for DOM-light tests | `DOMParser`/localStorage logic is much faster than Electron | Running everything in Electron would blow the 2-minute gate |

## Verification

- `npm run typecheck`, `npm run typecheck:test` pass.
- `npm test` runs the Vitest fast suite, exits non-zero on failure, and completes in under
  2 minutes.
- `npm run test:coverage` produces coverage for `shared/domain/**` and `shared/print/**`
  with thresholds enforced and generated files excluded.
- `npm run test:e2e` builds the app and runs the four Playwright journeys on Windows.
- The legacy assertion inventory maps every P1 behavior to a new test; all rows are
  `ported` and the legacy suite is removed.
- CI exposes separate fast, E2E and legacy jobs, uploads coverage/E2E artifacts, and fails
  on deterministic test failures.

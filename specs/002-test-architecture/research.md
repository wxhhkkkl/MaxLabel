# Research: Test Architecture Rebuild

**Feature**: `002-test-architecture` | **Date**: 2026-10-18

The decisions below are based on a read-only inventory of `app/scripts` (31 files,
~4,500 lines), `app/fixtures`, the app/build configuration, and the current CI workflow.
They resolve the technical unknowns in the spec; the owner confirmed the three top-level
choices (Vitest, Playwright Electron, full rewrite) on 2026-10-18.

## D-001: Vitest 5.0.5 as the single fast-suite runner

- **Decision**: Use Vitest 5.0.5 with Vite 7.3.6 for unit, contract and integration tests.
- **Rationale**: The app already builds with Vite/electron-vite; Vitest runs TypeScript
  directly, removes the legacy esbuild bundle-to-temp-file pattern, supports v8 coverage,
  and runs fast under Node. It can keep `shared/**` tests in a pure Node environment.
- **Alternatives considered**: Jest (extra TS/ESM config, duplicates the Vite toolchain);
  Node's built-in test runner (weak TS/mock/coverage ecosystem); keeping the legacy
  harness (violates FR-001/FR-002).
- **Constraints**: Pin Vitest and `@vitest/coverage-v8` exactly. Bump `@types/node` from
  20.x to ^22 to satisfy Vitest 5 peers and match `engines.node`. Keep the package CJS.

## D-002: Playwright 1.64.1 `_electron` for four critical journeys

- **Decision**: Use Playwright's Electron support against the **built** app
  (`out/main/index.js`), with one isolated `--user-data-dir` per test and bounded
  teardown.
- **Rationale**: Chromium/fabric/`Path2D` rendering and window geometry cannot run under
  jsdom. Playwright replaces the two hand-rolled hidden-window harnesses and gives
  screenshots/traces, a standard runner, and better failure reports.
- **Alternatives considered**: Keeping the esbuild hidden-window harness (no standard
  reporting, environment-sensitive); jsdom + node-canvas (fails: `Path2D is not
  defined`); a custom CDP harness (more maintenance).
- **P0 gate**: `_electron` is experimental and version-sensitive. Before writing journeys,
  run a spike: build, launch Electron 44.3.0, open `firstWindow`, screenshot, force-exit
  within a timeout. If it fails, stop and re-plan rather than building on a broken base.

## D-003: Full rewrite with the legacy suite as an oracle

- **Decision**: Build the new architecture from scratch and remove the legacy suite at the
  end, but keep it runnable (`test:legacy`) until equivalence is verified.
- **Rationale**: The owner chose a full rewrite. Running both suites during the transition
  prevents a coverage gap and provides an executable specification for the new tests.
- **Alternatives considered**: Incremental migration (safer but leaves two harnesses
  indefinitely); deleting first (unacceptable regression risk).
- **Control**: A legacy assertion inventory maps each P1 behavior to a new test or an
  approved retirement. Removal is one reversible commit.
- **Result (2026-10-18)**: every P1 row is `ported`; the legacy suite was removed and
  only build/generator/installer tooling remains in `app/scripts`.

## D-004: Test tree and layer boundaries

- **Decision**: Put new tests under `app/tests/{unit,contracts,integration,e2e,helpers}`;
  keep protocol goldens and `minimal.lsdx` in `app/fixtures`.
- **Rationale**: A single tree makes ownership and gate membership obvious; `unit` and
  `contracts` stay fast, `integration` is mock-heavy, `e2e` is Playwright-only.
- **Alternatives considered**: Co-locating tests next to source (good for locality but
  mixes runtime environments and complicates coverage/CI); keeping `app/scripts`
  (violates the rebuild goal).

## D-005: jsdom is only for DOM-light tests

- **Decision**: Use jsdom for `DOMParser`/LSDX import, localStorage-backed logic and
  React hook/component logic. Do not use jsdom for `renderLabel`, fabric canvases,
  barcode pixels or workspace geometry.
- **Rationale**: Verified in-memory: `renderLabel` under jsdom + node-canvas 3.2.3 fails
  with `Path2D is not defined`; font metrics and antialiasing also differ from Chromium.
- **Alternatives considered**: A `Path2D` shim (would test the shim, not Chromium);
  running all tests in Electron (too slow for the 2-minute gate).

## D-006: Controlled substitutes for main-process boundaries

- **Decision**: Mock `electron`, `fs/promises` (only where necessary), `child_process`,
  `net`, `renderLabel` and `bitmapSource`; prefer real OS temp directories for persistence
  tests; keep one Windows-only real-PowerShell ODBC case.
- **Rationale**: These boundaries touch the user's real profile, network and printers.
  Real temp dirs catch path/atomic-write bugs that pure mocks miss.
- **Alternatives considered**: Full end-to-end for every boundary (slow, side effects);
  mocking everything (misses real filesystem semantics).

## D-007: Golden files remain byte-exact

- **Decision**: Read `app/fixtures/protocol/*` as `Buffer`; compare byte length, SHA-256
  and required tokens. Keep `.gitattributes` `-text`. The generator remains the only
  update path.
- **Rationale**: Protocol output is binary text; CRLF conversion caused real failures in
  the current environment. The manifest already stores length/hash/tokens.
- **Alternatives considered**: Text normalization (hides real byte changes); snapshots
  with a JS runner (adds a second golden mechanism).

## D-008: Gate separation and CI shape

- **Decision**: `npm test` = typecheck + Vitest fast suite (unit/contracts/integration);
  `test:e2e` = build + Playwright; installer/release tests remain opt-in. The legacy
  `test:legacy` transition gate was removed on 2026-10-18 after the full port.
- **Rationale**: The current gate mixes pure unit tests with Electron and PowerShell,
  making it slow and environment-dependent. The new fast gate must stay under 2 minutes.
- **Alternatives considered**: One combined gate (slow, flaky); E2E on every unit test run
  (too expensive).

## D-009: Keep the CommonJS package format

- **Decision**: Do not add `"type": "module"`.
- **Rationale**: Electron main/preload are built as CJS; the legacy suite uses
  `require()`; changing the package format would alter build output and break the oracle.
- **Alternatives considered**: ESM package (cleaner for new tooling but out of scope and
  high-risk).

## D-010: Infrastructure for Electron download and environment

- **Decision**: Cache Electron's download in CI; document `ELECTRON_MIRROR` and
  `ELECTRON_GET_USE_PROXY`; delete `ELECTRON_RUN_AS_NODE` in the E2E fixture.
- **Rationale**: Electron is ~100 MB per install; the local shell sets
  `ELECTRON_RUN_AS_NODE=1`, which makes Electron start as Node and breaks launches.
- **Alternatives considered**: Ignoring the environment (fails on this machine);
  re-downloading Electron per job (slow).

## P0 Spike Result (2026-10-18)

- Electron 44.3.0 + Playwright 1.64.1 `_electron` launched the **built** app
  (`out/main/index.js`) successfully; first window title was `MaxLabel 标签设计`.
- `--user-data-dir=<temp>` also controls `app.getPath('userData')` in Electron 44
  (verified at runtime), so per-test profile isolation needs no product test hook.
- `app.exit(0)` followed by a bounded process kill works; the spike finished in ~1.2 s.
- Result: continue with Playwright E2E; keep the version pins exact.
- Follow-up: verify trace/screenshot artifacts and optional video on the first real
  journey.

## Audit Findings (2026-10-18)

`npm audit` reports 12 advisories (9 moderate, 3 high) in the existing
electron-builder / `@electron/get` / `global-agent` dependency chains (plus
`brace-expansion`, `http-cache-semantics`, `source-map-js`). `npm audit fix --dry-run`
does not resolve them without `--force`. The CI fast job runs the tests before the audit
step so coverage is still produced, but the audit remains a blocking check until the
dependency tree is resolved deliberately. Do not lower the audit threshold silently.

## Findings During Test Migration

### F-001: offline cloud sessions break after reload when `safeStorage` is unavailable

`cloud.ts` stores fallback sessions as `plain:<token>`. On the next `loadStore`, every
key that does not start with `enc:` is passed through `storedSessionToken` again, so
`plain:<token>` becomes `plain:plain:<token>` and can no longer be found by
`sessionEntry`. Reproduced while porting the cloud integration test (safeStorage mocked
unavailable). Per spec FR-033 this product defect is recorded, not fixed inside the test
rewrite; the test uses the encrypted-session path. Fix separately.

## Open Questions

| ID | Question | Default / next step |
|----|----------|---------------------|
| O-001 | Is 80% line coverage the right threshold for `shared/domain` and `shared/print`? | Start at 80%; adjust after the first full run. |
| O-002 | Does Playwright 1.64.1 support video/trace artifacts for Electron? | Verify in the P0 spike; if not, rely on screenshots + trace action log. |
| O-003 | Should the Windows-only real-PowerShell ODBC test stay in the fast gate? | Keep it in integration with a Windows guard; skip elsewhere. |
| O-004 | Do we need `@playwright/test` browser installs? | No; Electron uses its own Chromium. |
| O-005 | Which four E2E journeys are the final set? | Launch, open/save roundtrip, print preview, offline license (spec FR-013). |

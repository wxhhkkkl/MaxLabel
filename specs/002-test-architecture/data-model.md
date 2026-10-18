# Data Model: Test Architecture Rebuild

**Feature**: `002-test-architecture` | **Date**: 2026-10-18

This feature does not change product data. The entities below describe the test
architecture artifacts that must exist and stay consistent.

## TestLayer

A named layer with its own runtime, scope and gate membership.

| Field | Values | Meaning |
|-------|--------|---------|
| `name` | `unit` / `contracts` / `integration` / `e2e` / `legacy` / `release` | Layer identity |
| `runner` | `vitest` / `playwright` / `legacy` | Execution engine |
| `environment` | `node` / `jsdom` / `electron` | Runtime |
| `gate` | `fast` / `e2e` / `opt-in` / `transition` | Whether it blocks merges |
| `include` | glob(s) | Files belonging to the layer |
| `timeout` | seconds | Per-test/hook budget |

Relationships: one layer contains many test suites; each suite belongs to exactly one layer.

## TestSuite

A group of tests for one domain module or boundary.

| Field | Meaning |
|-------|---------|
| `id` | Stable identifier (e.g., `print.plan`, `ipc.contract`) |
| `layer` | Owning `TestLayer` |
| `sourceFiles` | Production modules under test |
| `legacySource` | Legacy file(s) used as the reference oracle |
| `priority` | `P1` / `P2` / `P3` (from spec 001/002) |
| `status` | `planned` / `ported` / `verified` / `retired` |

Validation: every P1 behavior in the legacy inventory must map to a suite with status
`ported` or `verified` before its legacy source can be retired.

## Fixture / GoldenFile

Immutable input or expected output.

| Field | Meaning |
|-------|---------|
| `path` | Repository-relative path |
| `kind` | `input` / `golden` |
| `byteExact` | Whether bytes/hash are compared |
| `lineEndingPolicy` | `preserve` / `lf` / `binary` |
| `updateCommand` | Command that regenerates the fixture, if any |
| `consumers` | Test suites using it |

Rules:

- Protocol goldens under `app/fixtures/protocol/**` are `byteExact` with
  `lineEndingPolicy: preserve`, protected by `.gitattributes -text`.
- `protocol-snapshots.json` stores `version`, `bytes`, `sha256` and `mustContain`.
- Updating a golden requires running the generator and reviewing the byte diff.

## LegacyAssertion

One behavior asserted by the legacy suite, tracked for equivalence.

| Field | Meaning |
|-------|---------|
| `id` | e.g., `PRINT-4`, `DATA-1`, `DOC-3`, `EDIT-5` |
| `legacyFile` | Source file and test name |
| `behavior` | One-sentence description |
| `newTest` | New test file/name, or empty |
| `decision` | `port` / `retire` / `split` |
| `approvedBy` | Owner approval reference for `retire` |

Validation: `decision: retire` requires an explicit approval note; an empty `newTest`
with `decision: port` blocks removal of the legacy suite.

## CoverageTarget

| Field | Meaning |
|-------|---------|
| `include` | `src/shared/domain/**`, `src/shared/print/**` |
| `exclude` | `**/*.generated.ts`, re-export-only files, type-only files |
| `metric` | `lines` (initial), later branches/functions |
| `threshold` | 80 (proposed) |
| `reporter` | text, json-summary, html, lcov |

Validation: thresholds are enforced by `test:coverage`; generated files must be excluded.

## CIJob

| Field | Meaning |
|-------|---------|
| `name` | `fast` / `e2e` / `legacy` / `release` |
| `runsOn` | `windows-latest` |
| `commands` | Ordered shell commands |
| `artifacts` | Coverage, Playwright report/test-results |
| `blocking` | Whether failure blocks merge |
| `timeoutMinutes` | Job budget |
| `cache` | npm + Electron download cache |

Rules:

- `fast` is blocking and must stay under the 2-minute test budget.
- `e2e` is blocking for the journeys it covers but runs in a separate job with retries.
- `legacy` is non-blocking during the transition and is removed at the end.
- `release` is opt-in/manual.

## E2EJourney

| Field | Meaning |
|-------|---------|
| `id` | `launch`, `template-roundtrip`, `print-preview`, `offline-license` |
| `preconditions` | Fresh userData, fixture path, server URL state |
| `steps` | User actions |
| `assertions` | UI/file/preview outcomes |
| `artifacts` | Screenshot, trace, optional video |
| `timeout` | 60 s default |

## ElectronTestContext

The per-test launch context.

| Field | Meaning |
|-------|---------|
| `electronApp` | Playwright `ElectronApplication` |
| `window` | First window / page |
| `userDataDir` | OS temp directory passed as `--user-data-dir` |
| `env` | Process environment with `ELECTRON_RUN_AS_NODE` removed |
| `builtAppPath` | `app/out/main/index.js` (must exist before launch) |
| `teardown` | `app.exit(0)` + bounded force-kill |

Validation: each test gets a unique `userDataDir`; closing the last window is not a valid
teardown because the main-window close guard prevents normal quit.

## Relationships

```text
TestLayer 1 ── * TestSuite
TestSuite * ── * Fixture/GoldenFile
LegacyAssertion * ── 1 TestSuite  (newTest)
CoverageTarget 1 ── 1 TestLayer  (unit/contracts/integration)
CIJob 1 ── * TestLayer
E2EJourney 1 ── 1 ElectronTestContext
```

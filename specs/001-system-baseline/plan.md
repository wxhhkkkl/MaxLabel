# Implementation Plan: MaxLabel Desktop System Baseline (As-Is)

**Branch**: `001-system-baseline` | **Date**: 2026-10-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-system-baseline/spec.md`

**Note**: This is a brownfield baseline. The plan maps the documented current behavior to
the existing codebase; it does **not** plan a rebuild. The only implementation work it
authorizes is restoring the test harness required by the constitution.

## Summary

MaxLabel is an existing Windows desktop application for designing and printing barcode
labels, compatible with the LabelShop workflow. This plan records how the 38 functional
requirements in the baseline spec map onto the current Electron main / preload /
renderer / shared layers, and identifies the evidence for each area. The automated test
harness was restored from the `parity` branch on 2026-10-18; `npm test` passes, so the
TDD gate is usable again.

No runtime behavior changes are planned. Any discrepancy found during verification is
recorded as a finding, not silently "fixed" inside this baseline work.

## Technical Context

**Language/Version**: TypeScript 5.5.4; Node.js ≥ 22.12.0

**Primary Dependencies**: Electron ^44.3.0, React 18.3.1, Fabric.js 7.4.0,
bwip-js ^4.4.1, @e965/xlsx 0.20.3, iconv-lite ^0.7.3, electron-vite ^5.0.0, Vite ^7.3.6

**Storage**: Local `.msdx`/`.json` template files; JSONL print log under Electron
`userData`; `safeStorage`-encrypted JSON for database/cloud secrets; external databases
via ODBC / SQL Server / MySQL / SQLite; local offline store when no cloud server is set

**Testing**: Restored from the `parity` branch (`546f151`) on 2026-10-18:
`app/scripts/` and `app/fixtures/` are back and `npm test` is re-enabled.
`npm run typecheck` and the full suite pass. Electron-based tests require
`ELECTRON_RUN_AS_NODE` to be unset; protocol fixtures are protected by `.gitattributes`
against CRLF conversion. UI alignment scripts and parity-dependent evidence/generator
scripts were removed on 2026-10-18 (owner decision); the gate now covers unit, protocol,
render and workspace regressions only.

**Target Platform**: Windows 10/11 x64 (electron-builder declares only a Windows x64 NSIS target)

**Project Type**: Desktop application (Electron)

**Performance Goals**: No product-level SLO is defined in the repository.
Hard limits found in code: script source 256 KB, script string 1 MB, logical print labels
100,000, copies per label 99,999, physical labels 1,000,000.
An explicit performance target remains `TODO(待确认)`.

**Constraints**: Offline editing must not depend on a license server; all print paths
share one `ResolvedPrintScene`/`PrintPlan`; a single physical geometry rule set; all
privileged operations go through main-process IPC with path/payload validation;
Windows printer drivers and TSPL/ZPL/CPCL are the supported output paths.

**Scale/Scope**: 5 user stories, 38 FR, 8 object types plus groups, 16 symbologies,
7 data-source kinds, 3 native command sets, 6 port types.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status | Notes / remediation |
|-----------|------|--------|---------------------|
| I. 测试先行（TDD） | New behavior must have tests written first, seen failing, then implemented | **PASS (restored 2026-10-18)** | The regression suite was restored from `parity` (`546f151`); `test` / `test:*` scripts are back and `npm test` passes. See `tasks.md` T001–T004. |
| II. 先澄清，不猜测 | Ambiguous scope/data/contract/state-machine changes must be clarified first | PASS | Open items are recorded as `TODO(待确认)` in the spec's Assumptions/Baseline Notes; no invented behavior. |
| III. 巨大架构变更先确认 | Architecture-level changes require explicit owner approval with options/impact/rollback | N/A (baseline) | This plan changes no architecture. Future work must follow the confirmation rule. |
| Evidence rule (CLAUDE.md) | Every FR traces to code/tests/commits | PASS | All 38 FR carry `Evidence:` references; unresolved items are separated in Baseline Notes. |

**Post-design re-check**: unchanged. The baseline plan introduces no design that could
violate the gates; the TDD remediation remains the only blocking item.

## Project Structure

### Documentation (this feature)

```text
specs/001-system-baseline/
├── spec.md              # As-is baseline specification
├── plan.md              # This file
├── research.md          # Decisions and open questions
├── data-model.md        # Entities and relationships
├── quickstart.md        # Run and validation guide
├── contracts/
│   ├── ipc.md           # Renderer ↔ main privileged interface
│   ├── template-format.md # .msdx / JSON template contract
│   └── print-output.md  # Resolved scene / plan / protocol output contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Verification/documentation backlog (Phase 2)
```

### Source Code (repository root)

```text
app/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # Window, preview, lifecycle
│   │   ├── license.ts           # Activation/re-check, local cache
│   │   ├── cloud*.ts            # Cloud client, credentials, repository
│   │   ├── sharedLibrary.ts     # Shared template library
│   │   ├── updater.ts           # Version check
│   │   ├── db.ts                # External database access
│   │   ├── secureJsonStore.ts   # safeStorage-backed persistence
│   │   ├── ipc/                 # Channel registration + validation
│   │   └── printing/            # Command transport (TCP/COM/USB/file)
│   ├── preload/index.ts         # Whitelisted IPC facade
│   ├── renderer/src/
│   │   ├── App.tsx              # Composition root
│   │   ├── editor/              # Editor shell components
│   │   ├── features/            # workspace, commands, editor, printing,
│   │   │                        #   canvas, object-properties, shell, data, exporting
│   │   ├── dialogs/             # Print, properties, template, license dialogs
│   │   ├── io/                  # .lsdx / .msdx import
│   │   ├── print/               # Label rendering / bitmap source
│   │   ├── rendering/           # Fabric adapters
│   │   └── pages/               # Start page
│   └── shared/
│       ├── domain/              # Document, objects, data sources, paper, printer
│       ├── print/               # Scene, plan, TSPL/ZPL/CPCL, bitmap, log schema
│       └── ipcContract.ts       # Shared IPC contract
├── build/                       # Packaging assets (icon)
├── package.json                 # Electron/React dependencies and scripts
└── electron.vite.config.ts      # Build configuration
```

**Structure Decision**: Single Electron application under `app/`. No new project or
service is introduced. The as-is layering is:

```text
renderer features ──► application workflows ──► shared domain
       │                                         │
       └────────► Fabric rendering adapter       └──► ResolvedPrintScene
                                                          │
                             TSPL / ZPL / CPCL ◄──────────┘

preload IPC facade ──► main IPC registrations ──► infrastructure services
```

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Documentation references `app/docs/architecture.md` from `parity` | Architectural rationale lives in a file removed from `main`. | Re-inventing the rationale would violate the evidence rule; reading it from the preserved branch is lossless. |

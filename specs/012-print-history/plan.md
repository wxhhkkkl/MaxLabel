# Implementation Plan: Print History and Log Management (As-Is)

**Branch**: `012-print-history` | **Date**: 2026-10-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/012-print-history/spec.md`

**Note**: Brownfield **as-is** baseline. The plan closes documentation and test gaps around
shipped log/history behaviour; it does not add a new logging feature.

## Summary

Document and verify the local print history: a JSONL log in the user-data directory, a
serialized append path with 64 MB/10 000-row limits, main-process payload validation, the
read-only history dialog (list, detail, data snapshot), CSV export, opening the raw file,
clearing all records and deleting one record by timestamp. Runtime behaviour stays
unchanged except for corrections a test proves necessary (for example corrupt-tail
handling and delete-by-timestamp ambiguity remain documented TODOs).

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Electron 44.3.0

**Primary Dependencies**: No new runtime dependency. Existing Electron `app.getPath`,
`fs/promises`, `shell`, `dialog`, the shared log schema, IPC validation and the renderer
history dialog.

**Storage**: `userData/print-log.jsonl`, one JSON object per line with `app: 'maxlabel'`.
CSV export is written wherever the user chooses. No database and no template changes.

**Testing**: Vitest (unit/contracts/integration) and Playwright Electron E2E. There is no
dedicated log test today; this plan adds validation, main-process file-lifecycle, CSV and
renderer formatting tests before any code change.

**Target Platform**: Windows 10/11 x64 primary; macOS/Linux paths use the same Electron APIs
per `005-cross-platform`.

**Project Type**: Desktop application (Electron main/preload/renderer/shared).

**Performance Goals**: History reads the newest ≤10 000 parseable rows; writes are serialized
and never block a successful print; the file is capped at 64 MB.

**Constraints**: Log failures must not roll back or block printing; no log entry for test
prints (003 FR-012); no template/persistence changes; no cloud sync.

**Scale/Scope**: 1 JSONL file per user profile, ≤64 MB, ≤10 000 displayed rows; CSV export
includes every parseable row; one row per print attempt (driver or command).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status | Notes |
|-----------|------|--------|-------|
| I. 测试先行（TDD） | New tests written and seen failing before code changes | **PASS** | Plan tasks start with failing validation/file/CSV/UI tests. Existing print-executor logging is verified, not rebuilt. |
| II. 先澄清，不猜测 | Ambiguities recorded, not guessed | **PASS (bounded)** | Delete-by-`time` collisions, CSV including rows beyond the 10 000 displayed, and truncated-tail recovery stay `TODO(待确认)`. |
| III. 巨大架构变更先确认 | No architecture-level change | **PASS** | No dependency, process, database or template change. The log file stays a JSONL in `userData`. |
| Single logging path | One writer, one schema | **PASS** | `log:print` remains the only writer; the schema/CSV headers stay in `shared/print/logSchema.ts`; the UI is read-only. |
| Evidence rule | Every FR traces to code/tests | **PASS** | Each FR in `spec.md` carries `Evidence:`; this plan adds tests for the currently code-only rules. |

**Post-design re-check**: unchanged; no violations, no complexity exceptions.

## Project Structure

### Documentation (this feature)

```text
specs/012-print-history/
├── plan.md              # This file
├── spec.md              # As-is specification
├── research.md          # Phase 0 decisions
├── data-model.md        # PrintLog, storage limits, status mapping
├── quickstart.md        # Validation scenarios
├── contracts/
│   ├── log-ipc.md
│   ├── log-file.md
│   └── history-ui.md
└── checklists/
    └── requirements.md
```

`tasks.md` is produced by `/speckit-tasks`.

### Source Code (repository root)

```text
app/src/main/
├── ipc/registerLogIpc.ts    # log:print/list/export/open/clear/delete, queue, 64 MB cap
└── ipc/validation.ts        # validatePrintLogPayload ranges/snapshots

app/src/shared/
├── ipcContract.ts           # log channels + MaxLabelAPI signatures
└── print/logSchema.ts       # CSV header order

app/src/preload/index.ts     # whitelisted log facade

app/src/renderer/src/
├── dialogs/PrintHistoryDialog.tsx   # list/detail/export/open/clear/delete
└── features/printing/printExecutor.ts  # writes one log per non-test attempt

app/tests/
├── contracts/                       # new: log payload/result contract
├── integration/main/                # new: JSONL lifecycle with temp userData
├── unit/renderer/                   # new: history formatting/status mapping
└── e2e/                             # new: history dialog smoke
```

**Structure Decision**: Keep the single JSONL writer in `registerLogIpc`, validation in
`validation.ts`, the read-only UI in `PrintHistoryDialog`, and the schema in
`shared/print/logSchema.ts`. No new module, package or persisted format is introduced.

## Phase 0 — Research

See [research.md](./research.md). Decisions:

- D-001: JSONL in `userData`; no database.
- D-002: Main-process payload validation before any write.
- D-003: Serialized write queue; reads/exports wait for queued writes.
- D-004: 64 MB cap compaction keeps ≤10 000 parseable rows; atomic rewrite.
- D-005: Reads take the newest ≤10 000 rows; invalid lines are skipped.
- D-006: CSV uses the fixed header, UTF-8 BOM and CRLF; export includes all parseable rows.
- D-007: Delete filters by `time`; collisions are a documented TODO.
- D-008: Open-log creates an empty file when missing and delegates to the OS.
- D-009: The history UI is read-only, newest first, with a detail panel and snapshot.
- D-010: Test prints are not logged; the `test` field remains for historical data.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md): `PrintLog`, `PrintHistoryRow`, CSV columns, storage
  limits, status semantics and validation ranges.
- [contracts/log-ipc.md](./contracts/log-ipc.md): channels, payloads, results, error keys,
  security and lifecycle.
- [contracts/log-file.md](./contracts/log-file.md): JSONL format, path, queue, cap,
  compaction, corrupt lines and CSV export.
- [contracts/history-ui.md](./contracts/history-ui.md): columns, detail fields, status
  mapping, empty/error states and actions.
- [quickstart.md](./quickstart.md): automated and manual validation scenarios.

## Complexity Tracking

No constitution violations; no complexity exceptions.

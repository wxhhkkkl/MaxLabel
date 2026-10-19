# Printing Pipeline — Invariants and Limits

**Feature**: `003-printing-pipeline` | **Date**: 2026-10-18 | **Commit**: `00bb6e1`

## Architecture Invariants

| ID | Invariant | Evidence | Result |
|----|-----------|----------|--------|
| I-001 | All output paths consume `ResolvedPrintScene`; adapters do not resolve data sources | `scene.ts`, `engine.ts`, `scene.test.ts` | pass |
| I-002 | `PrintPlan` is the single source of quantity/copies/slots/serials | `plan.ts`, `plan.test.ts` | pass |
| I-003 | Driver/native/preview share the same physical geometry | `layout.ts`, `scene.test.ts`, `render-harness.spec.ts` | pass |
| I-004 | Native output keeps only fully-inside objects; preview keeps all | `scene.ts`, `scene.test.ts` | pass |
| I-005 | Unsupported native features force page rasterization; missing bitmap blocks send | `capabilities.ts`, `printExecutor.ts`, `scene.test.ts` | pass (blocking branch reviewed) |
| I-006 | Only confirmed batches advance serials and enter log snapshots | `printExecutor.ts`, `print-executor.test.ts` | pass |
| I-007 | Native output is batched at 24 pages; file output is merged | `printExecutor.ts`, `print-executor.test.ts` | pass (file merge reviewed) |
| I-008 | Protocol goldens are byte-exact and protected from CRLF | `protocol-snapshots.json`, `protocol-golden.test.ts`, `.gitattributes` | pass |

## Limits Verified in Source

| Limit | Value | Source | Test status |
|-------|-------|--------|-------------|
| Logical labels | 100000 | `plan.ts` | reviewed |
| Copies per label | 99999 | `plan.ts` | reviewed |
| Physical labels | 1000000 | `plan.ts` | reviewed |
| Native batch pages | 24 | `printExecutor.ts` | asserted (25→2 batches) |
| Command file size | 64 MB | `printExecutor.ts` | reviewed |
| Command segments | 100000 | `printExecutor.ts` | reviewed |
| Driver payload | `MAX_DRIVER_DATA_BYTES` | `limits.ts`, `printExecutor.ts` | reviewed |

## Error Semantics

- Invalid counts/limits throw explicit limit messages.
- Empty datasets produce zero pages and block printing.
- Script hook failure blocks submission and publishes no partial state.
- Transport `unknown`/`failed` do not advance serials; `partial` advances confirmed
  labels only.
- Temporary files are removed on success and failure.

## Gaps

Remaining direct-test gaps: FR-011 (driver payload cap), FR-023 (batch preamble/postamble),
FR-030 (Bluetooth success), FR-061 (on-disk JSONL), FR-070/FR-072 (manual settings) and
FR-082 (temp cleanup observability). Limits, GBK, file merge, bitmap blocking and
multi-batch cancel are now directly asserted.

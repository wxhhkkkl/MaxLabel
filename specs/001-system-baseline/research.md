# Research: MaxLabel Desktop System Baseline (As-Is)

**Feature**: `001-system-baseline` | **Date**: 2026-10-18

This is a brownfield baseline. There are no unresolved technical unknowns that block
documentation; the decisions below are already embodied in the code and are recorded here
with their evidence. Items that require the owner's product decision are listed separately
as open questions rather than being guessed.

## Decisions

### D-001: Document current behavior instead of re-specifying a rebuild

- **Decision**: The baseline describes what the shipped application does today; no
  runtime redesign is part of this feature.
- **Rationale**: The product already exists and is in use. A rebuild-oriented
  specification would invite behavior drift and contradict the evidence rule.
- **Alternatives considered**: Re-derive requirements from the original LabelShop help
  only — rejected because it would not describe this implementation's actual behavior.

### D-002: One resolved print scene feeds every output path

- **Decision**: `LabelDoc + DataCtx` is resolved once into `ResolvedPrintScene`, then
  `PrintPlan`, and only then consumed by the driver, TSPL, ZPL and CPCL paths.
- **Rationale**: Data-source evaluation, group expansion, visibility, copies and label
  indices must produce identical results for preview, driver printing and native commands.
- **Alternatives considered**: Each protocol resolving data sources independently —
  rejected because it duplicates stateful logic (serial numbers, scripts) and causes
  preview/print divergence.
- **Evidence**: `app/src/shared/print/scene.ts`, `plan.ts`, `app/docs/architecture.md`
  (parity branch `546f151`).

### D-003: Scripts run in a restricted interpreter, not `eval`

- **Decision**: The script data source supports a limited VBScript/JavaScript-like
  expression and statement subset with explicit hooks and built-in variables; forbidden
  host capabilities are rejected.
- **Rationale**: Templates may come from cloud/shared libraries. Executing arbitrary
  JavaScript in the renderer would expose `require`, network, storage and DOM access.
- **Alternatives considered**: Node `vm` or `Function`-based sandbox — rejected because
  neither is a security boundary in Electron's renderer/main context.
- **Evidence**: `app/src/shared/domain/scriptRuntime.ts` (`forbidden` set, 256 KB source
  limit, 1 MB string limit), `app/src/shared/domain/datasource.ts`.

### D-004: Fall back to a monochrome page bitmap when native commands cannot be faithful

- **Decision**: If an object's rotation, complex text styling, fill/colour, ellipse or
  unknown barcode cannot be expressed equivalently in TSPL/ZPL/CPCL, the page is rendered
  as a bitmap; if the bitmap is not ready, the send is blocked.
- **Rationale**: A partially printed label is worse than a blocked one; users must not
  believe an incorrect label was printed completely.
- **Alternatives considered**: Silently dropping unsupported primitives — rejected
  because it produces unmarked partial output.
- **Evidence**: `app/src/shared/print/capabilities.ts`, `compat.ts`, `bitmap.ts`.

### D-005: Per-document history and serialized, path-aware saves

- **Decision**: Each document tab owns its undo/redo stack and revision; saves are
  serialized per path, and saving to a path already open in another tab is rejected.
- **Rationale**: Multi-document editing must not leak history across tabs or overwrite a
  file being edited elsewhere.
- **Alternatives considered**: One global history stack — rejected because undo would
  affect the wrong document.
- **Evidence**: `app/src/renderer/src/features/workspace/useDocumentHistory.ts`,
  `documentPersistence.ts`, `useDocumentWorkspace.ts`.

### D-006: Secrets stay in main-process encrypted storage; renderer gets capability paths

- **Decision**: Database passwords and cloud tokens are stored with Electron
  `safeStorage`; the renderer cannot read arbitrary paths by string, only paths produced
  by system dialogs.
- **Rationale**: The renderer hosts remote/user content (templates, images, scripts) and
  must be treated as less trusted than the main process.
- **Alternatives considered**: Storing secrets in template JSON or plain localStorage —
  rejected because templates are copied, shared and uploaded.
- **Evidence**: `app/src/main/secureJsonStore.ts`, `connectionSecrets.ts`,
  `cloudCredentials.ts`, `app/src/main/ipc/pathAccess.ts`.

### D-007: Single complete edition

- **Decision**: Licensing only determines whether the product is authorized; it does not
  unlock feature subsets. AI/cloud/shared templates/database/script features are standard.
- **Rationale**: The original product's edition layering was intentionally collapsed in
  the reimplementation.
- **Alternatives considered**: Feature-gated editions — rejected by the product owner's
  single-version policy.
- **Evidence**: `app/README.md`, `app/docs/architecture.md` (parity branch),
  `app/src/main/license.ts`.

## Open Questions (owner decisions, not blocking documentation)

| ID | Question | Why it matters | Where recorded |
|----|----------|----------------|----------------|
| Q-001 | 目标用户的行业分布与规模？ | 影响验收场景与性能目标 | **Resolved 2026-10-19**: 通用中小企业；无产品级性能 SLO。 |
| Q-002 | 典型标签尺寸与批量规模？ | 影响性能 SLO 与批量上限默认值 | **Resolved 2026-10-19**: 混合尺寸/批量，按客户模板；代码硬限制为唯一约束。 |
| Q-003 | 是否需要多语言界面？ | 影响文案与打包资源 | **Resolved 2026-10-19**: 中英双语为后续目标；当前界面仍为中文（Baseline Note）。 |
| Q-004 | 是否恢复完整回归测试套件？何时恢复？ | 宪法 TDD 门禁 | **Resolved 2026-10-18**: 002 重建了 Vitest/Playwright 测试架构；旧 parity 套件已移除，`npm test` 通过。 |
| Q-005 | 重写服务端后是否保留云数据库接口与 `/api/version`？ | 客户端已定义接口，旧服务端未实现 | 仍待产品决定；记录在 spec.md Baseline Notes。 |

Q-005 remains a product decision and does not prevent documenting the current baseline;
the other questions are resolved.

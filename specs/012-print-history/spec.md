# Feature Specification: Print History and Log Management (As-Is)

**Feature Branch**: `012-print-history`

**Created**: 2026-10-20

**Status**: Draft (as-is baseline; owner review pending)

**Input**: User description: "补写打印历史与日志管理的 as-is 规格：查看本地打印历史、详情与数据快照、导出 CSV、打开 JSONL、清空、删除单条，以及日志写入/容量/损坏容忍。以现有代码和测试为证据，不提出新功能。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 查看打印历史 (Priority: P1)

操作员从“查看 → 打印历史记录”打开历史窗口，看到按时间倒序的本地打印记录；每行显示时间、模板、打印方式、数量、拷贝、计划张数、已发送张数、状态、测试/正常与打印机。

**Why this priority**: 打印失败、补打与追溯都需要可读的本地历史。

**Independent Test**: 完成一次驱动打印后打开历史，最新记录显示模板名、`driver` 方式、逻辑数量、物理张数、`submitted` 状态与打印机名。

**Acceptance Scenarios**:

1. **Given** 存在打印记录，**When** 打开历史窗口，**Then** 记录按时间倒序显示，窗口标题与按钮随界面语言变化。
2. **Given** 记录缺少 `sentCount`，**When** 查看列表，**Then** 已发送张数显示为“—”，不显示 0。
3. **Given** 点击某行，**When** 查看详情，**Then** 显示时间、模板、方式、类型、数量、拷贝、计划/已发送张数、状态与打印机；若有数据快照则逐行显示。
4. **Given** 没有任何记录，**When** 打开窗口，**Then** 显示空状态提示与记录数 0。

---

### User Story 2 - 导出、打开与清理日志 (Priority: P2)

操作员把历史导出为 CSV，用系统文本编辑器打开 JSONL 原文件，或清空全部记录、删除单条记录。

**Why this priority**: 报表对账、问题排查与隐私清理需要文件级操作。

**Independent Test**: 导出 CSV，文件带 UTF-8 BOM 与固定表头；删除一条记录后列表刷新且剩余记录不变；清空后列表为空。

**Acceptance Scenarios**:

1. **Given** 有记录，**When** 点击“导出 CSV”，**Then** 弹出保存对话框，文件名默认含当天日期，导出列为时间/模板/打印方式/数量/单签拷贝/计划标签张数/已发送标签张数/状态/测试打印/打印机。
2. **Given** 无记录，**When** 点击“导出 CSV”，**Then** 提示暂无打印记录，不创建文件。
3. **Given** 点击“打开日志文件”，**When** 文件不存在，**Then** 先创建空文件再由系统打开。
4. **Given** 删除单条或清空，**When** 用户取消确认框，**Then** 记录不变。
5. **Given** 清空确认，**When** 执行完成，**Then** 列表为空且原文件被截断。

---

### User Story 3 - 日志可靠写入与容量控制 (Priority: P3)

打印完成后主进程把日志追加到本地 JSONL；并发写入串行化，损坏行被忽略，文件超过上限时压缩保留最近记录，历史读取有行数上限。

**Why this priority**: 日志不能阻塞打印，也不能无限增长或让历史窗口卡死。

**Independent Test**: 向日志文件写入一行损坏 JSON，再写入一条有效记录；历史窗口正常显示有效记录；文件超过 64 MB 后仍只保留最近不超过 10000 条。

**Acceptance Scenarios**:

1. **Given** 两个打印任务同时结束，**When** 写日志，**Then** 两次追加串行完成，不交叉损坏。
2. **Given** JSONL 含无法解析的行，**When** 读取历史，**Then** 跳过该行并继续。
3. **Given** 文件超过 64 MB，**When** 追加新记录，**Then** 先保留最近不超过 10000 条再追加。
4. **Given** 日志写入失败，**When** 打印已成功，**Then** 打印结果不被回滚，界面显示打印状态而非日志错误。

### Edge Cases

- 同一时间戳存在多条记录：删除按 `time` 匹配，会删除所有同时间记录（TODO(待确认)：是否需要唯一 ID）。
- 日志文件缺失：列表返回空数组；打开日志会先创建空文件。
- 文件超过 64 MB 且旧文件不可读：压缩时丢弃旧内容，只保留可解析记录。
- 读取上限 10000 行：历史窗口只显示最近 10000 条，导出读取全部可解析行。
- 数据快照缺失或为空：详情不显示快照区。
- 导出被取消：返回取消状态，不写文件。
- 测试打印不写日志（与 003 FR-012 一致），但历史记录 schema 仍保留 `test` 字段以兼容历史数据。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 查看菜单与打印窗体 MUST 提供“打印历史记录”入口；历史窗口 MUST 以模态对话框打开。
  Evidence: `app/src/renderer/src/features/commands/labelShopMenus.ts`、`app/src/renderer/src/editor/PrintDock.tsx`
- **FR-002**: 历史列表 MUST 从主进程读取本地日志，按时间倒序显示，最多 10000 条；无法解析的行 MUST 被跳过。
  Evidence: `app/src/main/ipc/registerLogIpc.ts`（`MAX_PRINT_LOG_ROWS`、`parseLogs`）、`app/src/renderer/src/dialogs/PrintHistoryDialog.tsx`（`reload` 排序）
- **FR-003**: 列表 MUST 显示时间、模板、方式、数量、拷贝、计划张数、已发送张数、状态、测试/正常、打印机；计划张数缺失时 MUST 用 `count × copies` 回退；已发送缺失 MUST 显示“—”。
  Evidence: `app/src/renderer/src/dialogs/PrintHistoryDialog.tsx` 表格列与 `formatNumber`
- **FR-004**: 状态 MUST 映射为：`partial` / `failed` / `canceled` / `unknown` / 其他视为 `submitted`，并随界面语言本地化。
  Evidence: `app/src/renderer/src/dialogs/PrintHistoryDialog.tsx`（`statusLabel`）
- **FR-005**: 点击行 MUST 展开详情，包含时间、模板、方式、类型、数量、拷贝、计划/已发送张数、状态、打印机；存在数据快照时 MUST 逐行显示。
  Evidence: `app/src/renderer/src/dialogs/PrintHistoryDialog.tsx` 详情区
- **FR-006**: “导出 CSV” MUST 使用固定表头（时间、模板、打印方式、数量、单签拷贝、计划标签张数、已发送标签张数、状态、测试打印、打印机），UTF-8 BOM + CRLF，默认文件名包含当天日期；无记录或取消时 MUST 不创建文件。
  Evidence: `app/src/main/ipc/registerLogIpc.ts`（`log:export`、`PRINT_LOG_CSV_HEADERS`）、`app/src/shared/print/logSchema.ts`
- **FR-007**: “打开日志” MUST 在文件不存在时创建空文件，然后交给操作系统默认程序打开。
  Evidence: `app/src/main/ipc/registerLogIpc.ts`（`log:open`）
- **FR-008**: “清空” MUST 经确认后截断日志文件；“删除单条” MUST 经确认后按 `time` 过滤并原子重写。
  Evidence: `app/src/renderer/src/dialogs/PrintHistoryDialog.tsx`（`handleClear`/`handleDelete` 的 `window.confirm`）、`app/src/main/ipc/registerLogIpc.ts`（`log:clear`/`log:delete`）
- **FR-009**: 日志 MUST 存放在用户数据目录的 `print-log.jsonl`，每行一个 JSON 对象并带 `app: 'maxlabel'` 标记。
  Evidence: `app/src/main/ipc/registerLogIpc.ts`（`printLogPath`、`log:print`）
- **FR-010**: `log:print` 载荷 MUST 在主进程校验（时间/模板/方式、数量范围、状态枚举、测试标志、快照长度与总量），非法载荷 MUST 返回 `error.log`。
  Evidence: `app/src/main/ipc/validation.ts`（`validatePrintLogPayload`）、`app/src/main/ipc/registerLogIpc.ts`
- **FR-011**: 日志写入 MUST 串行化；读取与导出 MUST 等待排队写入完成。
  Evidence: `app/src/main/ipc/registerLogIpc.ts`（`logQueue`、`waitLogWrites`）
- **FR-012**: 文件超过 64 MB 时 MUST 先压缩为最近不超过 10000 条可解析记录；重写 MUST 使用临时文件 + 原子重命名。
  Evidence: `app/src/main/ipc/registerLogIpc.ts`（`MAX_PRINT_LOG_BYTES`、`appendPrintLog`、`atomicWriteText`）
- **FR-013**: 读取或写入失败 MUST 返回带 `error.log` 的错误结果，不得导致渲染进程崩溃；打印执行器 MUST 忽略日志失败。
  Evidence: `app/src/main/ipc/registerLogIpc.ts` 各 handler、`app/src/renderer/src/features/printing/printExecutor.ts`（日志失败不影响打印）
- **FR-014**: 历史窗口的时间/数量 MUST 按当前语言格式化；错误消息 MUST 经 `localizeIpcMessage` 解析。
  Evidence: `app/src/renderer/src/dialogs/PrintHistoryDialog.tsx`（`formatDateTime`/`formatNumber`/`localizeIpcMessage`）

### Key Entities

- **PrintLog**: `time`、`title`、`mode`（driver/command）、`count`、`copies`、`physicalCount`、`status`、`sentCount`、`test`、`printer`、`dataSnapshot`、`app`。
- **PrintHistoryRow**: 历史窗口展示模型，含派生字段“计划张数”的回退值。
- **CSV 导出文件**: 固定表头 + 最近全部可解析记录，UTF-8 BOM、CRLF。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 打开历史窗口能在 10000 条记录内按时间倒序展示，损坏行不影响其余记录。
- **SC-002**: CSV 导出文件可被电子表格软件直接打开，中文表头与内容无乱码。
- **SC-003**: 删除单条后其余记录保持不变；清空后文件长度为 0。
- **SC-004**: 日志文件超过 64 MB 后不会继续无限增长，历史窗口仍可打开。
- **SC-005**: 日志失败不会把成功的打印变成失败，也不会阻塞下一行日志写入。

## Assumptions

- 日志是本机单文件存储，不参与云同步；本地打印历史与模板内容分离。
- `time` 由打印执行器生成（ISO 时间），删除以 `time` 为键。
- 历史窗口只读，不提供编辑或重新打印。
- 测试打印按 003 FR-012 不写日志；`test` 字段保留用于兼容历史数据。

## Baseline Notes (As-Is)

- `log:delete` 按 `time` 删除所有同时间记录；如果两个任务写入相同时间戳，会一并删除（TODO(待确认)：引入唯一 ID）。
- 历史窗口对损坏记录的容忍依赖逐行 `JSON.parse`；文件尾部的半行会被跳过（TODO(待确认)：是否需要恢复截断写入）。
- CSV 导出读取全部可解析行，不受 10000 行显示上限影响（TODO(待确认)：是否需要与列表一致）。

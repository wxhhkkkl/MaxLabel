# Feature Specification: Test Architecture Rebuild

**Feature Branch**: `002-test-architecture`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "把测试架构重构作为一个独立的 spec-kit 特性来做。采用 Vitest 作为统一运行器，Playwright Electron 覆盖关键旅程，旧测试全量重写；目标是让测试可读、可维护、分层清晰，并继续满足 TDD 门禁。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 统一、可靠的快速测试门禁 (Priority: P1)

开发者提交代码前运行 `npm test`，得到统一的运行器输出、清晰的失败定位和稳定的结果；
不再面对几十个一次性脚本、手写断言框架和临时产物。

**Why this priority**: 测试架构首先要让 TDD 可执行；没有可靠、统一的门禁，后续所有测试工作都会继续积累历史包袱。

**Independent Test**: 在一个干净检出上安装依赖并运行 `npm test`，确认所有测试由同一运行器执行、失败时返回非零退出码、成功时输出标准汇总。

**Acceptance Scenarios**:

1. **Given** 一个新检出的仓库，**When** 运行 `npm test`，**Then** 所有快速测试由同一运行器执行并输出统一汇总。
2. **Given** 任意一个测试失败，**When** 运行 `npm test`，**Then** 命令返回非零退出码，并指出文件、测试名和断言差异。
3. **Given** 开发者新增一个单元测试，**When** 保存并运行，**Then** 无需修改运行器配置或增加临时脚本即可被执行。

---

### User Story 2 - 核心领域行为全量重建 (Priority: P1)

测试维护者按照新的分层结构，重写打印流水线、数据源/脚本、文档模型与编辑器几何等核心领域的测试，
确保原有关键行为没有丢失。

**Why this priority**: 这些模块一旦回归会直接产生错误标签或数据丢失，是全量重写中必须优先锁定等价性的部分。

**Independent Test**: 逐个核心域对照旧测试清单和基线规格（`001-system-baseline`），确认每个关键行为都有新测试覆盖，且旧测试可以退役。

**Acceptance Scenarios**:

1. **Given** 旧套件中的打印流水线断言，**When** 新套件完成该域重写，**Then** 所有 P1 行为都有对应测试，且旧套件可以安全删除。
2. **Given** 序列号、日期、数据库、脚本等七类数据源，**When** 运行新单元测试，**Then** 每类数据源的解析与推进行为都被覆盖。
3. **Given** 一个协议输出快照，**When** 在不同操作系统/换行设置下运行，**Then** 测试结果一致，不因 CRLF/LF 产生误报。
4. **Given** 旧测试中存在但新架构未覆盖的行为，**When** 进入旧套件退役评审，**Then** 该行为必须先补齐测试，不能静默丢失。

---

### User Story 3 - 集成与契约测试重建 (Priority: P2)

测试维护者重建 IPC 契约、模板格式、数据库访问、授权与云服务等集成层测试，
用依赖注入或受控替身隔离文件系统、网络和 Electron API。

**Why this priority**: 这些边界最容易出现“单测通过、集成失败”的问题，且与安全、用户数据直接相关。

**Independent Test**: 在无网络、无真实打印机、无真实云服务的环境下运行集成测试，确认全部通过且不产生外部副作用。

**Acceptance Scenarios**:

1. **Given** IPC 通道契约，**When** 运行契约测试，**Then** 通道名称、载荷形状和校验规则与共享契约一致。
2. **Given** 模板 `.msdx` 信封和旧 JSON，**When** 运行格式测试，**Then** 迁移、规范化和密码脱敏行为被覆盖。
3. **Given** 无法连接数据库或云服务，**When** 运行集成测试，**Then** 测试使用受控替身并在有限时间内结束，不访问真实外部服务。

---

### User Story 4 - Electron 关键旅程 E2E (Priority: P2)

测试维护者使用 Playwright Electron 覆盖少量但关键的桌面旅程，替代几十个一次性 UI 脚本。

**Why this priority**: 桌面应用的窗口、IPC 和渲染协同无法只靠单元测试覆盖，但 E2E 应少而稳定。

**Independent Test**: 在 CI 的 Windows 环境中启动 Electron，依次完成启动、打开/保存、打印预览和离线授权旅程，全部通过。

**Acceptance Scenarios**:

1. **Given** 应用可启动，**When** 运行 E2E，**Then** 起始页和编辑器外壳正常加载。
2. **Given** 一个本地模板，**When** 通过 E2E 打开并保存，**Then** 文件内容往返一致。
3. **Given** 无有效授权且服务器不可达，**When** 启动并编辑，**Then** 本地编辑与保存不被阻断。
4. **Given** 一次 E2E 失败，**When** 查看报告，**Then** 能定位到失败步骤并查看截图/录像。

---

### User Story 5 - CI 分层与质量可见性 (Priority: P3)

团队在 CI 中分离快速门禁、E2E 和发布验证，能够看到覆盖率、运行时长和 flaky 趋势。

**Why this priority**: 测试架构的价值取决于持续可见；所有测试混在一个门禁里会越来越慢、越来越不可信。

**Independent Test**: 提交一次 PR，确认快速 job 与 E2E job 独立运行，且覆盖率报告可用。

**Acceptance Scenarios**:

1. **Given** 一次普通 PR，**When** CI 运行，**Then** 快速测试在目标时间内完成并作为合并门禁，E2E 独立运行。
2. **Given** 一次发布构建，**When** 运行发布验证，**Then** 安装包/安装器相关测试独立执行，不阻塞日常 PR。
3. **Given** 核心模块的覆盖率下降，**When** 查看报告，**Then** 能在 CI 中看到下降位置和阈值状态。

### Edge Cases

- CI 环境没有显示设备时，Electron E2E 必须使用无头/隐藏窗口模式或明确跳过并报告。
- 测试运行环境设置了 `ELECTRON_RUN_AS_NODE` 时，Electron 相关测试必须仍能正确启动或给出明确错误。
- 协议 golden 文件在不同换行设置下必须保持一致结果。
- 测试使用临时目录时，必须在成功和失败路径都清理，不污染用户目录。
- 依赖时间、时区、随机数的测试必须使用固定时钟/种子，避免跨机器不稳定。
- 无法连接打印机、数据库或云服务时，测试不得访问真实外部资源。
- 旧套件中依赖 `parity/`、`app/docs` 或安装包产物的测试不得进入新的快速门禁。

## Requirements *(mandatory)*

### Functional Requirements

#### 架构与运行器

- **FR-001**: The test suite MUST use a single, standard test runner for unit, contract and integration tests; ad-hoc `check()` harnesses and one-off runner scripts MUST NOT be used for new tests.
- **FR-002**: The runner MUST execute TypeScript tests directly through the existing Vite/TypeScript toolchain without generating temporary bundled files in the repository.
- **FR-003**: `npm test` MUST run the fast suite and return a non-zero exit code on any failure; a successful run MUST print a standard summary.
- **FR-004**: The fast suite MUST complete within 2 minutes on the development machine and Windows CI under normal load.
- **FR-005**: `npm run test:e2e` MUST run Electron journeys with Playwright and MUST be separate from `npm test`.
- **FR-006**: The test tree MUST be organized into explicit layers: unit, contracts, integration and e2e, with documented naming and location conventions.

#### 分层与范围

- **FR-010**: Unit tests MUST cover the pure domain modules: print scene/plan, protocol command generation, data sources and script runtime, document model/migration, units/geometry, barcode character rules.
- **FR-011**: Contract tests MUST cover the IPC channel/payload contract, template file format (`.msdx`/legacy JSON/`.lsdx` import), and protocol golden outputs.
- **FR-012**: Integration tests MUST cover main-process boundaries with controlled substitutes: template persistence, database access/cancellation, license activation/cache, and cloud repository behavior.
- **FR-013**: E2E tests MUST cover at least these journeys: application launch/start page, new/open/save a template, print preview, and offline editing without a reachable license server.
- **FR-014**: Tests MUST NOT depend on `parity/`, `app/docs` or any external LabelShop installation.
- **FR-015**: Release/installer verification MUST be a separate, opt-in test group and MUST NOT block the fast gate.
- **FR-016**: The new suite MUST re-express all P1 behaviors currently covered by the legacy suite before the legacy suite is removed.

#### 稳定性与隔离

- **FR-020**: Tests MUST use temporary directories and clean them on success and failure; they MUST NOT write into the repository or the user's real application data directory.
- **FR-021**: Tests MUST NOT access real printers, real network services or real cloud servers; external boundaries MUST be replaced by controlled substitutes.
- **FR-022**: Time-, timezone- and randomness-dependent tests MUST use fixed clocks/seeds.
- **FR-023**: Protocol golden tests MUST be byte-exact and MUST define a line-ending policy that produces identical results on Windows and Linux.
- **FR-024**: Unit tests MUST NOT retry; E2E retries MAY be enabled and MUST be reported separately from genuine failures.
- **FR-025**: A failing test MUST leave a reproducible command and sufficient diagnostics (assertion diff, console output, screenshot/video for E2E).

#### 迁移与清理

- **FR-030**: During the rebuild, the legacy suite MUST remain runnable as a reference oracle until the new suite covers its P1 assertions.
- **FR-031**: The legacy suite MUST be removed in one documented step after equivalence is verified; the removal MUST be reversible via version control.
- **FR-032**: Any legacy assertion that has no new equivalent MUST be listed and explicitly accepted or replaced before removal.
- **FR-033**: The rebuild MUST NOT change product behavior; any product defect discovered during test migration MUST be recorded and fixed in a separate change.

#### CI 与质量可见性

- **FR-040**: CI MUST run the fast suite on every push/pull request and use it as the merge gate.
- **FR-041**: CI MUST run the E2E suite in a separate job on Windows, with failure artifacts (screenshot/video/trace).
- **FR-042**: CI MUST publish coverage for the core domain/print modules and enforce thresholds.
- **FR-043**: The fast job MUST report total runtime and fail if it exceeds the agreed budget.
- **FR-044**: Flaky E2E failures MUST be visible separately from deterministic failures.

#### 文档与可维护性

- **FR-050**: The repository MUST include a testing guide describing the layers, how to add a test, how to run a single test, how to update golden files, and how to debug E2E.
- **FR-051**: Each test layer MUST have an owner-readable index mapping critical product behaviors to test files.
- **FR-052**: The architecture documentation MUST state which tests are part of the merge gate and which are opt-in.

### Key Entities

- **TestLayer**: unit / contracts / integration / e2e; defines runtime, scope and gate membership.
- **TestSuite**: a group of tests for one domain module or boundary.
- **Fixture / Golden File**: immutable input or expected output, with a defined update procedure.
- **Coverage Report**: per-module coverage for `shared/domain` and `shared/print`.
- **CI Job**: fast gate, E2E, release/installer verification, each with its own triggers and artifacts.
- **Legacy Assertion Inventory**: mapping from old test assertions to new tests or explicit retirement decisions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `npm test` completes in under 2 minutes and is the single merge gate for unit/contract/integration tests.
- **SC-002**: 100% of P1 behaviors listed in the legacy assertion inventory have a new test or an owner-approved retirement record.
- **SC-003**: Zero tests in the fast gate depend on `parity/`, `app/docs`, real printers, real network or cloud servers.
- **SC-004**: Core domain/print modules meet the agreed coverage threshold (proposed: ≥ 80% lines for `shared/domain` and `shared/print`).
- **SC-005**: The new suite passes 20 consecutive runs on Windows CI without a deterministic failure; E2E flakiness is reported separately.
- **SC-006**: CI exposes separate fast and E2E jobs, and a failing E2E produces screenshot/video/trace artifacts.
- **SC-007**: The legacy suite is removed in one documented change after the equivalence checklist is complete.
- **SC-008**: A developer can add and run a new test by following the testing guide without editing runner configuration.

## Assumptions

- The team selected **Vitest** as the runner for unit, contract and integration tests, and **Playwright for Electron** for E2E.
- The rebuild is a **full rewrite** of the test architecture: the final state uses one runner and the legacy suite is removed, but the legacy suite remains a reference oracle during the transition.
- The primary platform is Windows 10/11 x64; CI uses a Windows runner for E2E.
- Node.js ≥ 22.12.0 and Electron 44 are the runtime baseline (see `001-system-baseline`).
- Coverage targets apply to core modules, not to UI/dialogs or generated files.
- The four E2E journeys listed in FR-013 are the initial scope; additional journeys require a new decision.
- The rebuild does not introduce a new test management service or external reporting SaaS.
- The old test scripts deleted on 2026-10-18 remain available on the `parity` branch for reference.

## Out of Scope

- Product behavior changes or refactoring of production code solely to make it testable, unless separately approved.
- Performance/load testing, visual regression across all screens, and real-printer compatibility testing.
- Rebuilding the `parity/` LabelShop comparison harness.

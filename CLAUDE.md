# CLAUDE.md — MaxLabel

## 0. 先读项目宪法

`.specify/memory/constitution.md` 是本仓库最高效力约定。开始任何改动前先读它，尤其是：

- **测试先行（TDD）**：先写会失败的测试，再写实现；禁止事后补测试。
- **先澄清，不猜测**：跨层、改数据模型/IPC/打印流水线/持久化格式时先提问。
- **巨大架构变更先确认**：新服务/框架/部署单元、进程边界、核心契约、大规模删除等，
  先给出方案、代价和回滚方式，取得明确确认后再动手。

本文与宪法冲突时，以宪法为准。

## 1. 项目是什么

MaxLabel —— 桌面端条码标签设计打印软件，兼容「签赋 LabelShop」的操作习惯。
技术栈：Electron + React + Fabric.js；产品版本见 `app/package.json`（当前 1.0.22）。

当前仓库只保留桌面端 `app/`。`server/`、`parity/`、`tools/` 已于 2026-10-18 从
`main` 移除；**完整旧内容仍保存在 `parity` 分支（`546f151`）**，需要旧文档/测试时从
该分支读取，不要凭记忆重写。

## 2. 常用命令

```bash
cd app
npm install       # 首次
npm run dev       # 开发模式（热更新）
npm run build     # 生产构建，产物在 out/
npm run typecheck # 类型检查
```

测试命令：

```bash
cd app
npm test               # typecheck + Vitest（unit/contracts/integration）
npm run test:coverage  # 覆盖率（shared/domain + shared/print，80% 行）
npm run test:e2e       # Playwright Electron（先构建）
npm run test:spike     # Electron 启动/退出探针
```

测试架构说明见 `app/tests/README.md`，行为到测试的映射见 `app/tests/INDEX.md`。
旧 `app/scripts` 测试套件已于 2026-10-18 移除，只保留构建、生成器和安装包工具；
`app/docs/` 仍只在 `parity` 分支上，需要架构/兼容性文档时：

```bash
git show parity:app/docs/architecture.md
```

注意事项：

- Electron 相关测试要求环境变量 `ELECTRON_RUN_AS_NODE` 未被设置，否则 Electron 会以
  Node 模式启动。Git Bash 下用 `env -u ELECTRON_RUN_AS_NODE npm test`。
- `app/fixtures/protocol/**` 按字节比较，`.gitattributes` 已标记为 `-text`，避免
  Windows 检出时 LF 被转成 CRLF；若已被转换，运行 `npm run fixtures:print` 重新生成。
- E2E/渲染 harness 需要先 `npm run build`；`npm run test:e2e` 会自动构建。

## 3. 目录与边界

- `app/src/main/`：主进程（窗口、打印、IPC、云服务、授权、更新、日志）
- `app/src/preload/`：白名单 IPC facade
- `app/src/renderer/src/`：React UI；`features/` 业务模块，`editor/` 编辑器外壳，`dialogs/` 弹窗
- `app/src/shared/domain/`：文档、对象、数据源、单位、打印机模型
- `app/src/shared/print/`：`ResolvedPrintScene` / `PrintPlan` / TSPL / ZPL / CPCL

硬约束：

- renderer 不直接编排打印协议；协议适配器只消费 `shared/` 已解析的场景。
- 物理几何规则只存在一份；不要在编辑器里维护第二套。
- 特权操作走主进程 IPC，并做载荷、路径、端口校验。
- 设备差异放在 printer profile/capabilities，不按品牌写业务条件分支。

## 4. 规格流程（spec-kit）

- 宪法：`.specify/memory/constitution.md`
- 功能规格：`specs/NNN-<name>/spec.md`
  - 系统基线：`specs/001-system-baseline/spec.md`
  - 测试架构：`specs/002-test-architecture/spec.md`（已完成）
  - 打印流水线：`specs/003-printing-pipeline/spec.md`（as-is 基线）
  - 当前特性：`specs/018-online-update/spec.md`（在线更新链路）
  - 已规划：`specs/005-cross-platform/spec.md`（macOS/Linux 构建与传输）
- 当前特性指针：`.specify/feature.json`
- 技能文件：`.claude/skills/speckit-*`。若斜杠命令未在当前会话注册，按对应
  `SKILL.md` 手工执行，不要跳过其校验步骤。

**棕地补文档规则**：以代码、测试、提交历史为唯一证据；每条 FR 附 `Evidence:`；
无法确认的写 `TODO(待确认)`，不得编造。区分「当前行为」与「期望行为」。

## 5. 编码行为准则

**Think before coding.** 不假设、不隐藏困惑、主动说明取舍。有歧义先问；有更简单
的方案就说出来。

**Simplicity first.** 用最少的代码解决问题，不做未被要求的抽象、配置或“扩展性”。

**Surgical changes.** 只改必须改的；不顺手重构相邻代码；匹配现有风格；自己改动产生
的孤儿代码要清理，既有的死代码只提示、不删除。每一行改动都应能追溯到需求。

**Goal-driven execution.** 把任务转成可验证目标：加校验 → 先写失败测试再实现；
修 bug → 先写复现测试；重构 → 前后测试全绿。多步任务先列出「步骤 → 验证方式」。

**这些准则生效的标志**：diff 里无关改动少、不过度设计、澄清发生在实现之前而不是
返工之后。

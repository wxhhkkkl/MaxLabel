# Implementation Plan: Start Page Member Panel and Edition Authorization Gating

**Branch**: `017-start-page-license-gating` | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-start-page-license-gating/spec.md`

## Summary

重新设计起始页：左侧展示会员头像、脱敏手机号、公司名称、当前版本（标准版/专业版/企业版）、有效期、购买/续费与商城入口；右侧按登录态展示宣传 banner、最近模板、公共云模板库或“我的云模板”。同时引入统一的授权判定：有效会员订阅或有效加密狗满足其一即可编辑，二者都没有时进入只读；版本功能矩阵决定各版本可用功能，加密狗解除全部限制。

技术路径：把授权规则收敛到 `shared/domain` 的纯函数与唯一功能矩阵；主进程负责读取商城会员/订阅与厂商加密狗授权状态，通过新增的 IPC 契约向渲染层提供 `EntitlementState`；渲染层用它统一驱动起始页、菜单、工具栏、快捷键和命令守卫，并在文件保存等主进程入口做二次校验。加密狗读取采用可替换的适配器（开发期用可配置设备标识，发布前切到厂商工具写入的授权结果）。

## Technical Context

**Language/Version**: TypeScript 5.5；React 18.3；Electron 44.3；Node.js >= 22.12

**Primary Dependencies**: Electron（主进程/预加载/渲染进程）、React、Fabric.js（编辑器画布）、Vitest 5、Playwright 1.64；现有商城 REST 接口（`/app-api/...`）

**Storage**: 现有本机 JSON/安全存储（`license.json`、`mall-credentials.json`、`localStorage` 的选项与最近模板）；新增授权快照缓存；商城服务端保存会员、订阅、套餐与云模板

**Testing**: `npm run typecheck`、`vitest`（unit/contracts/integration）、`playwright test`（Electron e2e）；先写失败测试再实现

**Target Platform**: Windows 桌面（Electron）；加密狗适配器以 Windows 为首个平台，macOS/Linux 适配留出接口（对应 005-cross-platform）

**Project Type**: 桌面应用（单仓库，`app/src/main`、`app/src/preload`、`app/src/renderer`、`app/src/shared`）

**Performance Goals**: 起始页在 2 秒内显示本地内容；加密狗状态变化后 2 秒内反映到授权状态（轮询间隔 ≤1 秒，留出处理余量）；授权状态变化在同一会话内生效，无需重启

**Constraints**: 离线可用（授权缓存有效到订阅到期日）；不因新增授权能力引入原生模块依赖（本期加密狗读取用系统命令/设备标识适配）；任何本地状态不得直接提升权限；打印流程与几何计算不改动

**Scale/Scope**: 单用户桌面应用；最近模板最多 10 条；云端模板列表沿用现有分页上限（200 条/页）；起始页 2 栏、3 类内容区

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 宪法原则 | 结论 | 说明 |
|----------|------|------|
| I. 测试先行（TDD） | PASS | 每个实现阶段先补 unit/contracts/integration/e2e 失败测试；授权矩阵、加密狗适配、只读守卫、起始页分区均先写测试 |
| II. 先澄清，不猜测 | PASS | 规格已完成 5 项澄清；剩余外部依赖 D-01（矩阵逐项确认）与 D-02（厂商读取接口）已显式记录，不用猜测替代 |
| III. 巨大架构变更先确认 | PASS（需所有者批准） | 新增主进程加密狗读取服务、授权 IPC 契约、商城会员/套餐字段与加密狗读取适配层；本计划即为确认材料，未获批准前不开始实现。详见 Complexity Tracking |
| 分层约束 | PASS | 授权规则放 `shared/domain`；主进程只负责读取硬件/商城状态；渲染层不直接编排商城协议；不新增第二套几何或打印规则 |
| 可回滚 | PASS | 新增模块与 IPC 可独立回退；移除起始页内嵌商城与令牌补写逻辑时同步回退对应测试；模板文件格式不变 |

## Project Structure

### Documentation (this feature)

```text
specs/017-start-page-license-gating/
├── plan.md              # 本文件
├── research.md          # Phase 0：关键技术决策
├── data-model.md        # Phase 1：授权/版本/起始页数据模型
├── quickstart.md        # Phase 1：端到端验证指南
├── contracts/           # Phase 1：授权 IPC 与商城接口契约
│   ├── entitlement-ipc.md
│   └── mall-api.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2（/speckit-tasks 生成，本命令不创建）
```

### Source Code (repository root)

```text
app/src/shared/
├── domain/
│   ├── entitlement.ts            # 新增：版本枚举、功能键、唯一功能矩阵、授权解析纯函数
│   └── entitlement.test 覆盖位置：app/tests/unit/shared/
├── ipcContract.ts                # 扩展：EntitlementState、DongleState、商城会员/套餐字段
└── i18n/                         # 新增只读/升级/授权提示文案（中英）

app/src/main/
├── dongle/
│   ├── dongleReader.ts           # 新增：DongleReader 接口 + 平台适配调度
│   ├── windowsVolumeReader.ts    # 新增：Windows 卷标/序列号适配（开发期）
│   └── vendorDongleReader.ts     # 新增：厂商授权读取适配（待 D-02，占位/接口）
├── entitlementService.ts         # 新增：聚合会员订阅 + 加密狗，产出 EntitlementState、离线快照、变更通知
├── license.ts                    # 复用现有在线授权（不改变现有激活语义）
├── mallAuth.ts / mallRepository.ts # 扩展：会员公司名/头像/版本、套餐版本字段
├── secureJsonStore.ts            # 复用：授权快照安全存储
├── ipc/
│   ├── registerEntitlementIpc.ts # 新增：entitlement:status / entitlement:changed
│   └── registerTemplateIpc.ts    # 扩展：保存前二次校验编辑权限
└── index.ts                      # 启动 entitlementService 与加密狗轮询；移除起始页内嵌商城监听

app/src/preload/index.ts          # 扩展：entitlement API（status / onChanged）

app/src/renderer/src/
├── App.tsx                       # 接入 useEntitlements；只在授权允许时创建/修改/保存；只读提示
├── pages/
│   ├── StartPage.tsx             # 重构：左栏会员面板 + 右栏内容区；移除商城 iframe
│   └── start/                    # 新增：ProfileCard、PromoBanner、RecentTemplates、CloudTemplates
├── features/
│   ├── entitlement/
│   │   ├── useEntitlements.ts    # 订阅主进程授权状态
│   │   └── entitlementGuards.ts  # 只读/版本限制的统一提示与命令守卫
│   ├── editor/editorAvailability.ts # 扩展：接入只读与功能矩阵
│   ├── commands/labelShopMenus.ts   # 菜单项禁用/升级提示
│   ├── commands/useLabelShopShortcuts.ts # 快捷键守卫
│   └── workspace/useRecentTemplates.ts   # 复用最近模板
├── editor/Toolbar.tsx            # 图标按钮按授权禁用 + 升级提示
├── dialogs/
│   ├── MallAccountDialog.tsx     # 购买/续费入口对齐版本套餐
│   └── ...                       # 受限功能的对话框入口加守卫
└── styles.css                    # 起始页两栏、只读状态条、升级提示样式

app/src/main/mallService.ts       # 移除起始页 iframe 令牌补写/监听（由本特性取代）

app/tests/
├── unit/shared/entitlement.test.ts
├── unit/main/dongle.test.ts
├── integration/main/entitlement-service.test.ts
├── contracts/entitlement-ipc.test.ts
├── unit/renderer/start-page.test.ts        # 扩展：分区/空错状态
└── e2e/start-page-entitlement.spec.ts      # 只读、加密狗模拟、起始页分区
```

**Structure Decision**: 沿用现有 Electron 单仓库四层结构。授权规则放 `shared/domain`（唯一矩阵、纯函数）；硬件读取放 `main/dongle`（平台适配）；渲染层只消费 IPC 状态并做 UI 守卫。新增 `main/entitlementService.ts` 与 `main/ipc/registerEntitlementIpc.ts`，不新增独立进程或服务端。

## Phase Plan（实现阶段，测试先行）

### Phase A — 授权模型与功能矩阵（shared）

1. 先写 `tests/unit/shared/entitlement.test.ts`：
   - 未登录/订阅无效/加密狗无效 → `editable=false`、`print=true`、其余功能为 false；
   - 标准版/专业版/企业版按功能矩阵返回；
   - 同时持有多版本订阅取最高档；
   - 加密狗有效 → 全部功能 true（与登录态无关）；
   - 订阅到期、加密狗拔出 → 回到对应限制；
   - 菜单/工具栏/快捷键使用同一 `FeatureKey` 判定。
2. 实现 `shared/domain/entitlement.ts`：`Edition`、`FeatureKey`、`FEATURE_MATRIX`、`resolveEntitlement(input)`、`editionLabel`。
3. 扩展 `shared/ipcContract.ts` 的 `MallMember`（`companyName?`、`avatarUrl?`、`edition?`、`subscriptionEndTime?`）与授权 DTO。

### Phase B — 加密狗读取（main）

1. 先写 `tests/unit/main/dongle.test.ts` + `tests/integration/main/dongle-reader.test.ts`：
   - 卷标/序列号与配置匹配 → valid；
   - 未插入、未写入授权、读取失败、过期/损坏 → 对应 reason，且永不默认 valid；
   - 轮询在 2 秒内反映变化；
   - 打包构建忽略开发期配置（仅非打包且显式测试开关时允许模拟）。
2. 实现 `main/dongle/dongleReader.ts`（接口 + 状态 diff + 1s 轮询，保证 2 秒内反映）、`windowsVolumeReader.ts`（系统命令读取卷信息，不引入原生依赖）、`vendorDongleReader.ts`（D-02 接口占位）。
3. 在 `main/index.ts` 启动/停止轮询；通过回调通知 entitlementService。

### Phase C — 授权聚合与 IPC（main/preload）

1. 先写 `tests/integration/main/entitlement-service.test.ts` + `tests/contracts/entitlement-ipc.test.ts`：
   - 聚合会员订阅 + 加密狗；离线时使用有效快照；快照过期转未授权；
   - 登录/续费/加密狗变化后推送 `entitlement:changed`；
   - 通道白名单、载荷校验、仅主窗口可调用。
2. 实现 `main/entitlementService.ts`：读取商城凭据、刷新订阅、持久化授权快照（`secureJsonStore`）、计算状态、变更事件。网络失败时保留最近一次成功校验的凭据与快照；只有服务端明确拒绝（401）才清除，必要时调整 `mallAuth.readMallSession` 的错误分类。
3. 新增 `main/ipc/registerEntitlementIpc.ts`（`entitlement:status`、`entitlement:changed`），扩展 preload facade 与 `IPC_CHANNELS`。
4. 在 `registerTemplateIpc` 的保存入口加二次校验：`editable=false` 时拒绝保存并返回可见错误；打印/IPC 打印链路不变。

### Phase D — 渲染层授权与只读守卫

1. 先写测试：
   - `useEntitlements` 纯逻辑测试（状态映射、离线提示）；
   - `editorAvailability`/菜单模型测试：只读时所有创建/修改命令禁用，查看/打印/打开保持可用；
   - 命令守卫测试：`applyDocument`、撤销/恢复、粘贴/删除、保存、云端保存/分享被拒绝且给出原因；
   - 编辑中授权失效（到期/拔狗）时，全部标签页与未保存内容保留并转只读。
2. 实现 `features/entitlement/useEntitlements.ts`、`entitlementGuards.ts`；在 `App.tsx` 包装 `applyDocument`/`undo`/`redo`/`saveTab`/`requestNew`/`handleTool`/剪贴板等入口。
3. 菜单/工具栏：`labelShopMenus` 与 `Toolbar` 接收 `entitlement`，受限项加锁标记与升级提示；`useLabelShopShortcuts` 对修改类快捷键短路。
4. 只读状态条/对话框：统一提示“登录有效会员或插入加密狗后可编辑”，提供登录/续费/商城入口。

### Phase E — 起始页重构

1. 先写 `tests/unit/renderer/start-page.test.ts` 扩展 + e2e：
   - 未登录：左栏登录入口、右栏 banner/最近模板/公共云模板；
   - 登录：头像、脱敏手机号、公司名、版本、有效期、购买、商城；右栏“我的云模板”；
   - 空态/加载失败/重试；登录态切换即时更新。
2. 实现 `pages/start/*` 组件与 `StartPage.tsx` 两栏布局；移除 iframe 商城视图与 `startView` 的 mall 分支。
3. 移除 `mallService` 的 iframe 令牌补写/监听及相关测试（该行为由本特性取代）。
4. 购买流程：未登录先登录/注册，登录后通过商城提供的购买深链直接打开购买/续费页；复用 `mall.open`/`MallAccountDialog` 的购买入口。
5. 云端区域：未登录用公共共享模板列表，登录用个人云模板；加载模板走现有 `openDoc`，只读时允许。

### Phase F — 版本功能限制接线

1. 先写测试：每个受限功能在菜单、工具栏、快捷键三种入口的可用性一致；受限功能显示升级提示；加密狗覆盖矩阵。
2. 逐项接线：
   - `databaseSources`：数据库菜单、DataPanel、DB 配置按钮；
   - `batchDataSources`：序列号/日期时间/键盘输入数据源选项；
   - `printHistory`：打印历史菜单/面板入口；
   - `cloudTemplates`：分享、云模板与共享模板上传/保存；
   - `scripts`：脚本相关选项与导出；
   - `scaleAutoPrint`：电子秤自动打印开关；
   - `rfidObjects`：RFID 工具与属性页；
   - `extendedBarcodeTypes`：条码类型下拉中非“常用”项；常用码制清单见 `data-model.md`（Code 39/128、EAN-13/8、UPC-A/E、Interleaved 25、ITF 14、QR Code、Data Matrix、PDF 417），其余归企业版。
3. 受限项在 UI 上锁定并给出“升级/插入加密狗”入口；命令层同样拒绝执行。

### Phase G — 商城接口与资料字段

1. 按 `contracts/mall-api.md` 扩展 `mallRepository`：会员资料（公司名/头像/版本）、按版本的套餐列表、订阅版本；保持现有 `/app-api` 前缀与错误处理。
2. 在 `MallAccountDialog` 与起始页购买入口展示版本套餐；续费沿用同一版本。
3. 后端字段未就绪时的降级：公司名“未填写”、默认头像、套餐不分版本时不显示版本购买项（显式错误提示，不伪造数据）。

### Phase H — 端到端、回归与发布

1. Playwright e2e（使用非打包测试授权注入，仅测试环境）：
   - 未授权只读：新建/修改/保存被拒，打开/预览/打印可用；
   - 模拟标准/专业/企业：功能差异与升级提示；
   - 模拟有效加密狗：全部功能可用；
   - 起始页两栏与登录态切换。
2. 回归 `npm test`、`npm run test:e2e`、`npm run build`。
3. 更新 `tests/INDEX.md` 映射；在 `quickstart.md` 记录人工验证步骤（含真实加密狗与真实商城账号）。
4. 发布前移除/关闭测试授权注入（打包构建不读取）。

## Testing Strategy

- **单元**：授权矩阵纯函数、只读命令守卫、起始页分区纯逻辑、加密狗输出解析。
- **契约**：新增 IPC 通道命名/载荷/白名单；商城字段与套餐契约。
- **集成**：entitlementService 聚合/离线快照/变更通知；模板保存二次校验；加密狗读取适配。
- **端到端**：只读、三档版本、加密狗、起始页两种登录态；真实登录/真实加密狗作为人工验收项记录在 quickstart。
- **回归**：现有 689 条测试 + 36 条 e2e 必须全绿；移除内嵌商城相关测试时同步删除对应断言。

## Risks & Mitigations

| 风险 | 影响 | 缓解 |
|------|------|------|
| D-01 矩阵逐项未最终确认 | 功能分档偏差 | 初版矩阵已写入规格；实现以唯一矩阵驱动，调整只改数据不改逻辑 |
| D-02 厂商授权读取接口未提供 | 加密狗无法正式上线 | 先实现适配器接口与开发期读取；发布前必须切换并做真实硬件验收 |
| 商城缺少公司名/头像/版本/套餐字段 | 左栏信息与购买页不完整 | 约定降级展示与显式错误；不伪造会员数据，列为上线前依赖 |
| 只读漏掉某个编辑入口 | 未授权仍可修改 | 统一守卫 + 入口清单测试 + e2e 覆盖菜单/工具栏/快捷键/画布 |
| 加密狗轮询开销/误判 | 性能或误放行 | 仅在状态变化时推送；读取失败一律无效；轮询间隔 ≤1 秒且可配置，保证 2 秒内反映 |
| 移除内嵌商城影响既有功能 | 回归 | 明确该行为被本特性取代；同步删除/更新相关测试与文档 |
| 离线快照被篡改 | 权限提升 | 快照放安全存储，含到期时间；解析失败按未授权 |

## Complexity Tracking

| 变更 | 为什么需要 | 更简单的替代方案及不足 |
|------|------------|------------------------|
| 新增主进程加密狗读取服务与 ≤1 秒轮询 | 硬件授权是规格的编辑门槛之一，且需响应运行中插拔 | 仅在启动时检测：无法满足“插入后 2 秒内解锁/拔出即只读” |
| 新增 `entitlement:status` / `entitlement:changed` IPC | 渲染层需要单一授权状态；主进程持有凭据与硬件访问 | 渲染层自行拼装：会重复规则、无法保证“本地状态不能提升权限” |
| 新增 `shared/domain/entitlement.ts` 唯一矩阵 | 菜单/工具栏/快捷键必须一致 | 在各组件内写条件：容易漂移，测试无法覆盖一致性 |
| 修改商城会员/套餐契约 | 左栏版本/公司名与按版本购买依赖后端字段 | 只在前端映射现有会员：无法区分三档版本，购买页无版本套餐 |
| 移除起始页内嵌商城与令牌补写 | 新起始页右侧改为 banner/最近模板/云模板，商城入口移至左栏 | 保留 iframe：与规格的右侧内容区冲突，且残留无用代码 |

## Post-Design Constitution Re-Check

- **I. TDD**：PASS — Phase A–H 均先列失败测试。
- **II. 澄清**：PASS — 5 项决策已写入规格；D-01/D-02 为外部依赖而非未决猜测。
- **III. 架构确认**：PASS（需所有者批准本计划）— 新增服务、IPC 与商城契约已完整列出，可回滚；未改变模板格式与打印几何。
- **分层**：PASS — 授权规则在 `shared/domain`，硬件在主进程，渲染层只消费状态。

# Research: Start Page Member Panel and Edition Authorization Gating

**Feature**: `017-start-page-license-gating` | **Date**: 2026-10-22

本文件记录计划阶段需要确定的技术决策。每项包含决策、理由与被否决的替代方案。

## R-01 授权状态的唯一来源与计算位置

**Decision**: 授权状态由主进程计算，渲染层通过 `entitlement:status` 获取快照、通过 `entitlement:changed` 接收变更。主进程聚合：
1. 商城会员凭据（`mallCredentials` + `mallAuth.readMallSession`）→ 订阅是否有效、版本、到期日；
2. 加密狗读取器（`main/dongle`）→ 是否插入、厂商授权是否有效；
3. 共享纯函数 `shared/domain/entitlement.ts` 的 `resolveEntitlement` → `editable` 与功能矩阵。

**Rationale**:
- 凭据与硬件都在主进程，渲染层无法可靠地自行判断“有效会员/有效加密狗”；
- 规格要求“不得因为界面状态、缓存伪造或本地开关提升权限”；
- 菜单、工具栏、快捷键、保存校验共享同一个快照，避免多处规则漂移。

**Alternatives considered**:
- 渲染层分别读取 mall 状态和 dongle 状态后自行判断：规则重复，且渲染层状态可被篡改，否决。
- 每个功能各自调用授权接口：延迟高、状态不一致，否决。

## R-02 加密狗读取方案（D-02 未到位时）

**Decision**: 定义 `DongleReader` 接口，本期提供：
- `windowsVolumeReader`：用系统命令读取可移动卷的卷标与卷序列号，与集中配置的期望值匹配；
- `vendorDongleReader`：按 D-02 的厂商接口读取授权结果（接口占位，发布前必须启用）；
- 读取器按平台选择；状态每 1 秒轮询一次（保证状态变化后 2 秒内反映），仅在变化时推送。

**Rationale**:
- 用户已选择“厂商工具写入授权”为最终有效性来源，但 D-02 尚未提供；
- 不引入原生模块（`usb`/`usb-detection`）可以避免安装包与 CI 的构建风险；
- 适配器隔离使厂商方案到位后只替换一个实现，不影响授权判定与 UI。

**Alternatives considered**:
- 直接引入厂商 SDK：D-02 未提供，且会引入原生依赖与签名/驱动问题，暂缓。
- 仅启动时检测：无法满足运行中插入/拔出的 2 秒要求，否决。
- 仅前端模拟/本地开关：违反“本地状态不得提升权限”，否决。

## R-03 只读状态的执行层与打印副作用

**Decision**:
- 渲染层统一守卫：`applyDocument`、撤销/恢复、粘贴/删除、新建、保存、云端保存/分享、对象工具、属性提交；
- 允许：打开本机/公共云/我的云模板、查看、缩放、选择、数据集记录浏览、预览、打印；
- 主进程在保存类 IPC（`template:save`、`template:saveTo`、`template:saveToLib`、云模板保存/分享）做二次校验；
- 只读打印不推进序列号、不自动保存（打印本身允许，文档保持不变）。

**Rationale**:
- 规格明确只读允许查看/预览/打印，但“修改文件”包含保存；
- 序列号推进与自动保存会改变文档，违背只读；
- 二次校验防止绕过渲染层直接调用 IPC。

**Alternatives considered**:
- 只在 UI 禁用按钮：快捷键、右键菜单、脚本仍可触发，否决。
- 只读完全禁止打印：与规格冲突，否决。
- 只读打印允许推进序列号：会修改文档，且无法持久化（不能保存），导致每次打印重复序列号，否决。

## R-04 版本功能矩阵的表达与接线

**Decision**: 在 `shared/domain/entitlement.ts` 定义：
- `Edition = 'none' | 'standard' | 'professional' | 'enterprise'`
- `FeatureKey`：`editDocuments`、`print`、`databaseSources`、`batchDataSources`、`printHistory`、`cloudTemplates`、`scripts`、`scaleAutoPrint`、`rfidObjects`、`extendedBarcodeTypes`
- `FEATURE_MATRIX: Record<Edition, Record<FeatureKey, boolean>>`（none = 全部 false，print 除外）
- 加密狗有效时 `resolveEntitlement` 直接返回全部 true，覆盖矩阵。

菜单、工具栏、快捷键、对话框与命令守卫都读取同一个 `entitlement.features[key]`。

**Rationale**:
- 规格要求“唯一矩阵、三处一致”；共享纯函数可在单元测试中穷举；
- 功能键按“动作”而非“对象类型”命名，方便跨入口复用；
- 矩阵调整只改一张表，不改调用点。

**Alternatives considered**:
- 在每个组件里按 edition 写条件：重复且难测，否决。
- 用后端下发整张矩阵：本期 D-01 未要求动态配置，且离线不可用，否决。

**映射说明（实现时逐项落到代码）**:
- `databaseSources`：数据库菜单、DataPanel、连接配置与数据库数据源；
- `batchDataSources`：序列号/日期/时间/键盘输入数据源；
- `printHistory`：打印历史菜单与面板入口；
- `cloudTemplates`：分享、云模板/共享模板的保存与上传（加载仍允许）；
- `scripts`：脚本选项、脚本数据源、脚本导出；
- `scaleAutoPrint`：电子秤自动打印；
- `rfidObjects`：RFID 工具与属性；
- `extendedBarcodeTypes`：常用条码之外的码制。常用码制清单固定为：Code 39、Code 128、EAN-13、EAN-8、UPC-A、UPC-E、Interleaved 25、ITF 14、QR Code、Data Matrix、PDF 417；其余（Code 93、CodaBar、Code 25、Matrix 25、China Post、Pharmacode、GS1 RSS、汉信码、Micro QR）归企业版。清单调整只改 `FEATURE_MATRIX`/码制分组表，不散落到组件。

## R-05 离线授权快照

**Decision**: 主进程在每次成功校验订阅后，将 `{ edition, expiresAt, checkedAt, memberMasked }` 写入安全存储（`secureJsonStore`）。启动时若在线校验失败：
- 快照存在且 `now < expiresAt` → 按快照授权；
- 快照不存在/已到期/解析失败 → 未授权（只读）。

**Rationale**: 与规格“用到订阅到期日”一致；快照不含明文手机号；解析失败不提升权限。
**补充**: 现有 `mallAuth.readMallSession` 会在令牌刷新失败时清除凭据（包括断网造成的失败）。实现时必须区分“服务端拒绝（401）”与“网络/服务不可达”：前者清除，后者保留最近一次成功凭据与快照，否则离线授权会在令牌到期后失效。`entitlementService` 读取凭据时不得先触发清凭据路径。

**Alternatives considered**:
- 固定宽限期（7/30 天）：用户已否决，且与在线到期不一致。
- 不缓存：离线不可编辑，体验差且规格要求离线可用。

## R-06 起始页数据来源与商城接口缺口

**Decision**:
- 左栏资料：`mall:session` 返回的 `MallMember` 扩展 `companyName`、`avatarUrl`、`edition`、`subscriptionEndTime`；
- 购买/续费：`mall:plans` 返回按版本分组的套餐（新增 `edition` 字段），购买页按版本展示；购买入口使用商城提供的购买/续费深链，避免在 `/mall` 首页让用户自行找入口；
- 右栏：
  - banner：产品内置静态素材与固定跳转；
  - 最近模板：复用 `useRecentTemplates`（本机历史，最多 10 条）；
  - 未登录云模板库：公共/共享模板列表（若服务端仍要求登录，则显示登录引导，不阻断其它区域）；
  - 已登录“我的云模板”：`mall.templates.list`，加载走现有 `openDoc`。

**Rationale**: 最大限度复用现有 IPC 与对话框逻辑；后端缺口显式降级。

**Alternatives considered**:
- 新建独立云端目录服务：超出本特性范围，否决。
- 把公共模板写死在前端：无法维护且与商城数据不一致，否决。

## R-07 端到端测试的授权注入

**Decision**: 增加仅非打包环境的测试注入 `MAXLABEL_TEST_ENTITLEMENT`（`readonly|standard|professional|enterprise|dongle`），由 `entitlementService` 在 `app.isPackaged === false` 时读取；打包构建完全忽略。另有单元测试断言打包环境忽略该变量。

**Rationale**: 真实商城登录与真实加密狗无法在 CI/自动化中稳定复现；需要可重复验证只读与三档功能差异。

**Alternatives considered**:
- 在 E2E 中走真实商城登录：依赖外部账号/网络，不稳定，否决。
- mock 渲染层 IPC：无法验证主进程授权聚合与保存校验，覆盖率不足。

## R-08 起始页内嵌商城与令牌补写的处置

**Decision**: 移除 `StartPage` 的商城 iframe、`startView` 的 `mall` 分支、`mallService.seedEmbeddedMallFrames` 与 `watchEmbeddedMallSession`，并删除/改写对应测试与 `tests/INDEX.md` 条目；商城入口移到左栏并通过现有 `mall:open` 打开。

**Rationale**: 新规格的右栏是 banner/最近模板/云模板，不再内嵌商城；保留 iframe 会与右栏内容冲突，且令牌补写逻辑无使用方。

**Alternatives considered**:
- 保留 iframe 作为“商城”区域并叠加新内容：布局冲突、维护两套入口，否决。

## R-09 跨平台加密狗读取

**Decision**: 本期只实现 Windows 适配；接口按平台可扩展，macOS/Linux 在其他平台返回“不支持/未插入”的明确原因，待 005-cross-platform 落地时补适配。

**Rationale**: 当前发布目标为 Windows（NSIS x64）；跨平台构建仍在规划中。接口隔离保证后续不改变授权判定。

**Alternatives considered**:
- 本期同时做三平台：无对应硬件与构建目标，成本高且不可验证，否决。

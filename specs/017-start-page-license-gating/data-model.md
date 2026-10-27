# Data Model: Start Page Member Panel and Edition Authorization Gating

**Feature**: `017-start-page-license-gating` | **Date**: 2026-10-22

本文件描述授权、版本、加密狗与起始页所需的数据结构。字段是实现契约的依据，类型以 TypeScript 表述；持久化位置在“存储”列注明。

## 1. 枚举与常量

### Edition

| 值 | 展示名 | 说明 |
|----|--------|------|
| `none` | 未订阅 | 未登录、订阅无效或无有效版本 |
| `standard` | 标准版 | 基础设计、打印与常用条码 |
| `professional` | 专业版 | 标准版 + 数据库/批量数据/打印记录 |
| `enterprise` | 企业版 | 专业版 + 云端与共享模板/脚本/电子秤/RFID/全部条码 |

### FeatureKey

`editDocuments`、`print`、`databaseSources`、`batchDataSources`、`printHistory`、`cloudTemplates`、`scripts`、`scaleAutoPrint`、`rfidObjects`、`extendedBarcodeTypes`

功能键含义：

| FeatureKey | 覆盖行为 |
|------------|----------|
| `editDocuments` | 新建、修改、保存、撤销/恢复、粘贴/删除；只读时 false |
| `print` | 打印与预览；任何授权状态都为 true（只读也允许） |
| `databaseSources` | 数据库连接、数据库数据源、云端数据库 |
| `batchDataSources` | 序列号、日期/时间、键盘输入数据源 |
| `printHistory` | 打印历史记录查看 |
| `cloudTemplates` | 云模板/共享模板的保存、上传、分享；加载不受限 |
| `scripts` | VBScript 相关编辑与执行 |
| `scaleAutoPrint` | 电子秤自动打印 |
| `rfidObjects` | RFID 对象创建与属性 |
| `extendedBarcodeTypes` | 常用条码之外的码制 |

**常用码制清单（用于 `extendedBarcodeTypes` 判定）**

- 常用（标准版/专业版/企业版均可用）：Code 39、Code 128、EAN-13、EAN-8、UPC-A、UPC-E、Interleaved 25、ITF 14、QR Code、Data Matrix、PDF 417。
- 企业版扩展：Code 93、CodaBar、Code 25、Matrix 25、China Post、Pharmacode、GS1 RSS 条码、汉信码、Micro QR。

> 清单调整只改本表与 `FEATURE_MATRIX`，不得在组件内另写码制条件。

### FEATURE_MATRIX

| FeatureKey | none | standard | professional | enterprise |
|------------|------|----------|--------------|------------|
| editDocuments | false | true | true | true |
| print | true | true | true | true |
| databaseSources | false | false | true | true |
| batchDataSources | false | false | true | true |
| printHistory | false | false | true | true |
| cloudTemplates | false | false | false | true |
| scripts | false | false | false | true |
| scaleAutoPrint | false | false | false | true |
| rfidObjects | false | false | false | true |
| extendedBarcodeTypes | false | false | false | true |

> 加密狗有效时，`resolveEntitlement` 对全部 FeatureKey 返回 true，覆盖上表。

## 2. 会员与订阅

### MallMember（扩展现有 `shared/ipcContract.ts`）

| 字段 | 类型 | 必填 | 说明 / 校验 |
|------|------|------|-------------|
| `userId` | number | 是 | > 0 |
| `mobileMasked` | string | 是 | 已脱敏；不得存完整号码用于展示 |
| `nickname` | string? | 否 | 展示名 |
| `companyName` | string? | 否 | 客户自行填写的公司名称；**起始页左栏不展示**（2026-10-27） |
| `avatarUrl` | string? | 否 | 头像地址；缺失时用内置占位图 |
| `edition` | Edition | 是 | 当前有效版本中的最高档；无有效订阅为 `none` |
| `subscriptionActive` | boolean | 是 | 至少一个版本订阅有效 |
| `subscriptionEndDate` | string? | 否 | 当前最高档版本的到期日（展示） |
| `subscriptionEndTime` | string? | 否 | 精确到期时间（授权判定用） |
| `remainingDays` | number? | 否 | 展示用 |
| `periodMonths` | number? | 否 | 套餐周期 |
| `sourceOrderNo` | string? | 否 | 订单号（不展示完整值） |

**校验规则**
- `companyName` 长度 ≤ 100；`avatarUrl` 仅允许 https/http 或应用内置资源；
- `edition` 必须属于枚举；无法识别时按 `none` 处理；
- 展示手机号必须已脱敏，完整号码不得进入 UI 状态或日志。

### SubscriptionPlan（扩展现有 `MallPlan`）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `spuId` / `skuId` | number | 是 | 现有字段 |
| `edition` | Edition | 是 | 套餐所属版本（standard/professional/enterprise） |
| `periodMonths` | number | 是 | 1/12 等 |
| `price` | number | 是 | 分或元（沿用现有单位） |
| `name` / `picUrl` / `stock` / `sort` | 现有 | 否 | 展示 |

**校验规则**：套餐必须带可识别版本；购买/续费时版本与套餐一致，不允许跨版本续费。

## 3. 加密狗

### DongleState

| 字段 | 类型 | 说明 |
|------|------|------|
| `present` | boolean | 是否检测到配置的授权设备 |
| `valid` | boolean | 厂商授权是否有效 |
| `reason` | `'absent'｜'unwritten'｜'expired'｜'unreadable'｜'rejected'｜'unsupported'` | 无效原因；`valid=true` 时为空 |
| `identifierMasked` | string? | 脱敏设备标识，仅用于诊断/日志 |
| `checkedAt` | string | ISO 时间 |

**状态转换**
- `absent` → 插入并读取成功且授权有效 → `valid=true`；
- 任意状态 → 拔出 → `absent`；
- `valid=true` → 授权过期/读取失败 → `valid=false` 且 reason 对应；
- 读取失败不得回退为 `valid=true`。

**安全**
- 设备标识与授权数据不作为日志明文输出；不写入模板；
- 本地配置文件只提供期望标识（开发期），生产环境使用厂商授权结果。

## 4. 授权快照与状态

### EntitlementSnapshot（离线缓存，安全存储）

| 字段 | 类型 | 说明 |
|------|------|------|
| `edition` | Edition | 最近一次成功校验的版本 |
| `expiresAt` | string | 订阅到期时间；快照仅在此时间前有效 |
| `checkedAt` | string | 最近一次成功在线校验时间 |
| `memberMasked` | string | 脱敏手机号（诊断/展示用，不含完整号码） |
| `schemaVersion` | number | 当前为 1；无法解析时按未授权 |

**校验规则**
- `now >= expiresAt` → 快照失效；
- 解析失败、字段缺失、枚举非法 → 按未授权；
- 主进程写入，渲染层只读；
- 网络失败不得删除快照或凭据，只有服务端明确拒绝（401）才清除。

### EntitlementState（IPC 输出）

| 字段 | 类型 | 说明 |
|------|------|------|
| `editable` | boolean | 是否允许新建/修改/保存 |
| `edition` | Edition | 当前版本；加密狗授权时为 `enterprise`（全部功能） |
| `editionLabel` | string | 展示文案：未订阅/标准版/专业版/企业版/加密狗（全部功能） |
| `source` | `'none'｜'member'｜'dongle'｜'member+dongle'` | 授权来源 |
| `features` | Record\<FeatureKey, boolean\> | 功能可用性 |
| `subscriptionActive` | boolean | 会员订阅是否有效 |
| `expiresAt` | string? | 会员到期时间 |
| `offline` | boolean | 本次判定是否来自离线快照 |
| `dongle` | DongleState | 加密狗原始状态 |
| `checkedAt` | string | 本次判定时间 |

**不变量**
- `editable === features.editDocuments`；
- `features.print === true` 恒成立；
- 加密狗 `valid=true` → `source` 含 `dongle` 且所有 features 为 true；
- `source='none'` → `editable=false`。

## 5. 起始页数据

### ProfileView（左栏）

| 字段 | 来源 | 缺失时 |
|------|------|--------|
| `avatar` | `MallMember.avatarUrl` | 内置占位图 |
| `mobileMasked` | `MallMember.mobileMasked` | 未登录显示登录入口 |
| `editionLabel` | `EntitlementState.editionLabel` | “未订阅” |
| `subscriptionState` | 订阅有效/已过期/未订阅 | 未登录不显示 |
| `expiresAt` | `MallMember.subscriptionEndTime/EndDate` | 永久/未知时明确文案 |
| `purchaseEntry` | 固定入口 | 未登录先登录/注册 |
| `mallEntry` | 固定入口 | 始终可用 |

### RecentTemplate（复用现有）

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 展示名，≤255 |
| `path` | string? | 本机路径；无路径的记录仅展示不可直接打开 |

现有 `useRecentTemplates` 已实现最多 10 条、去重、`state !== 1` 过滤；本特性直接复用。

### CloudTemplateItem（右栏）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | 模板编号 |
| `name` | string | 名称 |
| `widthMm` / `heightMm` | number? | 尺寸 |
| `category` / `keywords` | string? | 分类/关键词 |
| `publisherNickname` | string? | 公共模板显示发布者 |
| `updateTime` | string? | 更新时间 |
| `scope` | `'public'｜'mine'` | 未登录/登录决定数据来源 |

### PromoBanner

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | string | 产品内置文案 |
| `subtitle` | string? | 副标题 |
| `image` | 内置资源 | 静态素材 |
| `target` | `'mall'｜'upgrade'｜'guide'` | 固定跳转目标 |

## 6. 关系与状态流

```text
MallMember ──拥有──> SubscriptionPlan（按 edition）
     │
     └─ subscriptionActive/expiresAt ─┐
                                      ├─> resolveEntitlement ─> EntitlementState ─> UI/命令守卫
DongleState ──present/valid───────────┘
                                      │
                                      └─> 离线快照（仅会员，含 expiresAt）
```

**登录状态变化**
- 登录成功/续费成功 → 主进程刷新会员订阅 → 重新计算 → 推送 `entitlement:changed`；
- 退出登录 → 会员来源移除；若加密狗有效仍可编辑；
- 订阅到期/加密狗拔出 → 立即转只读，保留未保存内容。

**只读转换**
- 触发：无有效会员且无有效加密狗；运行中授权失效；
- 行为：`editable=false`；已打开文档保留；菜单/工具栏/快捷键/保存入口禁用；打印可用但不推进序列号、不自动保存。

# Contract: Mall API Extensions

**Feature**: `017-start-page-license-gating` | **Date**: 2026-10-22

桌面端通过主进程访问商城接口。现有约定保持不变：

- 基础地址：`FIXED_MALL_ORIGIN`（`https://new.yuwangchenfa.com`）
- API 前缀：`/app-api`
- 请求头：`tenant-id: 162`、`terminal: 31`、登录后 `Authorization: Bearer <accessToken>`
- 响应包：`{ code, data, msg }`；`code !== 0` 视为业务错误；HTTP 401 / `code=401` 视为登录过期

本文件只列出本特性新增或需要扩展的字段；其它接口（云模板、共享模板、打印上报）沿用现有契约。

## 1. 会员资料

**Endpoint**: `GET /app-api/member/user/get`（现有）
**Auth**: 需要

**新增可选响应字段**

| 字段 | 类型 | 说明 |
|------|------|------|
| `companyName` | string? | 公司名称；缺失时桌面端显示“未填写” |
| `avatarUrl` | string? | 头像 URL；缺失时用内置占位图 |

**桌面端映射**（`fetchMallMember`）
- `companyName` 仅接受字符串，长度截断到 100；
- `avatarUrl` 仅接受 `https:`/`http:`；其它协议忽略；
- 缺失/非法字段不导致整次会话失败。

## 2. 订阅与版本

**Endpoint**: `GET /app-api/member/subscription/get`（现有）
**Auth**: 需要

**新增响应字段**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `edition` | `'standard'｜'professional'｜'enterprise'` | 是 | 当前生效版本；无有效订阅时 `active=false` 且可缺省 |
| `endTime` | string? | 否 | 精确到期时间（ISO）；优先于 `endDate` 用于授权判定 |
| `activeEditions` | string[]? | 否 | 账号同时持有的有效版本（用于取最高档） |

**兼容规则**
- 仅返回 `edition` 时按该版本处理；
- 返回 `activeEditions` 时取 `standard < professional < enterprise` 的最高档；
- 无法识别或缺失版本且 `active=true` 时，桌面端按 `none` 处理并记录诊断信息，不猜测版本。

## 3. 版本套餐

**Endpoint**: `GET /app-api/product/subscription-plan/list`（现有）
**Auth**: 匿名

**新增响应字段**（每个套餐）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `edition` | `'standard'｜'professional'｜'enterprise'` | 是 | 套餐所属版本 |

**桌面端行为**
- 按版本分组展示；购买/续费时提交对应 `skuId`；
- 套餐缺少 `edition` 时不展示为可购买版本，避免把通用会员误当成某档版本；
- `fetchMallPlans` MUST 映射并保留 `edition`，无版本套餐不得进入购买列表（需要单测）。

**购买/续费深链**

商城 MUST 提供一个可直接到达购买/续费页的路径（例如 `/mall/purchase?...`），由桌面端在登录完成后打开。桌面端通过 `AppOptions.mallPurchasePath` 读取该路径，只接受站内 `/...` 路径（拒绝绝对 URL / javascript:），否则回退 `/mall`；在商城提供前使用回退值并记录该依赖，确保 SC-004 的点击数可验证。

## 4. 公共云模板库（未登录浏览）

**Endpoint**: `GET /app-api/member/shared-template/page`（现有，当前需要登录）
**Auth**: 期望支持匿名/公开读取

**要求**
- 未登录时仅返回公开（已审核、公开范围）的模板元数据；不返回私有字段或发布者完整身份；
- 若后端暂不支持匿名访问，桌面端在未登录时点击云模板先引导登录，并明确提示；不得伪造本地目录。

**响应字段**沿用现有 `MallSharedTemplate`：`id`、`name`、`widthMm`、`heightMm`、`category`、`keywords`、`publisherNickname`、`publishedTime`。

## 5. 我的云模板

**Endpoint**: `GET /app-api/member/cloud-template/page`（现有）
**Auth**: 需要

本特性不改变接口；起始页在登录后展示该列表，加载模板走 `mall:template-load`，只读状态下允许加载与查看。

## 6. 错误与降级

| 场景 | 桌面端行为 |
|------|------------|
| 会员资料缺少公司名/头像 | 显示“未填写”/默认头像 |
| 订阅缺少版本 | 按未授权（只读）处理，提示更新客户端或联系客服 |
| 套餐缺少版本 | 不显示对应购买项，提示暂不可购买 |
| 公共模板匿名读取失败 | 云模板区域显示登录引导/重试，不影响 banner 与最近模板 |
| 网络超时 | 使用离线授权快照（会员）或显示可重试错误；不提升权限 |
| 401/令牌过期 | 走现有刷新逻辑；刷新失败清凭据并转只读 |

## Test obligations

- `fetchMallMember` 对新增字段的类型/协议校验与缺失降级（单元/集成）。
- `fetchMallSubscription` 对 `edition`/`activeEditions`/`endTime` 的解析与无效值处理。
- `fetchMallPlans` 保留 `edition`，并按版本分组（单元）。
- 未登录公共模板列表的失败路径不影响起始页其它区域（渲染逻辑测试/e2e）。

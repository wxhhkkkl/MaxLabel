# Quickstart: Start Page Member Panel and Edition Authorization Gating

**Feature**: `017-start-page-license-gating` | **Date**: 2026-10-22

本指南用于端到端验证本特性。自动化测试覆盖授权矩阵、只读守卫与起始页分区；真实商城账号与真实加密狗作为人工验收项。

## 1. 环境与命令

```bash
cd app
npm install                 # 首次
npm run typecheck           # 类型检查
npm test                    # unit + contracts + integration
npm run build               # 生产构建
npm run test:e2e            # Playwright（会自动构建）
npm run dev                 # 开发模式
```

> Git Bash 下如 Electron 以 Node 模式启动，使用 `env -u ELECTRON_RUN_AS_NODE npm test`。

## 2. 数据与测试开关

- 商城地址固定为 `https://new.yuwangchenfa.com`，租户 `162`。
- 自动化无法稳定完成真实登录与真实加密狗插拔，使用**仅非打包环境**的授权注入：

```bash
# 启动应用时注入授权状态（仅 electron-vite dev / 未打包构建生效）
MAXLABEL_TEST_ENTITLEMENT=readonly npm run dev
MAXLABEL_TEST_ENTITLEMENT=standard npm run dev
MAXLABEL_TEST_ENTITLEMENT=professional npm run dev
MAXLABEL_TEST_ENTITLEMENT=enterprise npm run dev
MAXLABEL_TEST_ENTITLEMENT=dongle npm run dev
```

- 打包构建（`app.isPackaged === true`）必须完全忽略该变量；相应单元测试必须存在。
- 动态授权（模拟编辑中失效）：`MAXLABEL_TEST_ENTITLEMENT_FILE=/path/state.json`，文件内容 `{ "mode": "enterprise" }`，可随时改成 `{ "mode": "readonly" }`，主进程每 500ms 读取一次。仅非打包构建。
- 模拟会员登录态：`MAXLABEL_TEST_MALL_MEMBER='{"userId":1,"mobileMasked":"138****0000","companyName":"测试公司","edition":"enterprise","subscriptionActive":true,"subscriptionEndTime":"2099-01-01T00:00:00.000Z"}'`。仅非打包构建。
- 动态会员（模拟未登录→登录）：`MAXLABEL_TEST_MALL_MEMBER_FILE=/path/member.json`；初始写 `{ "loggedOut": true }`，点击登录前写入上面的会员 JSON，`mall:login` 会读取该文件并返回会员。仅非打包构建。
- 购买深链：`AppOptions.mallPurchasePath`（产品/商城下发，只接受站内 `/...` 路径，否则回退 `/mall`）。
- 真实加密狗读取使用 `main/dongle` 适配器；打包构建只接受注入的厂商校验函数，D-02 未到位时视为未授权。开发期用 `MAXLABEL_DONGLE_IDS` 卷标/序列号适配。

## 3. 自动化验证场景

### 3.1 未授权只读（`MAXLABEL_TEST_ENTITLEMENT=readonly`）

| 操作 | 预期 |
|------|------|
| 启动应用 | 起始页两栏可见；左栏显示登录/注册入口；右栏显示 banner、最近模板、公共云模板库 |
| 点击新建 / 对象工具 / 菜单编辑项 / 快捷键粘贴、删除 | 不创建/不修改；显示“登录有效会员或插入加密狗后可编辑” |
| 打开本机模板、公共云模板、云模板 | 可以打开、缩放、预览、打印；画布只读 |
| 保存 / 另存为 / 云端保存/分享 | 拒绝并提示只读原因 |
| 打印含序列号的对象 | 打印输出使用当前序列号；文档序列号不推进、不自动保存 |
| 编辑中授权失效（到期/拔狗） | 全部标签页保持打开、未保存内容保留，应用转只读并给出恢复入口 |

### 3.2 三档版本（standard / professional / enterprise）

| 功能 | 标准版 | 专业版 | 企业版 |
|------|--------|--------|--------|
| 基础设计、打印、常用条码 | 可用 | 可用 | 可用 |
| 数据库数据源 | 不可用（升级提示） | 可用 | 可用 |
| 序列号/日期/键盘输入 | 不可用 | 可用 | 可用 |
| 打印历史 | 不可用 | 可用 | 可用 |
| 云端/共享模板保存与分享 | 不可用 | 不可用 | 可用 |
| 脚本/电子秤/RFID/全部条码 | 不可用 | 不可用 | 可用 |

对每个受限功能分别验证：菜单项、工具栏按钮、快捷键三种入口的判断一致，且提示一致。

### 3.3 加密狗（`MAXLABEL_TEST_ENTITLEMENT=dongle` 或真实设备）

- 任一版本（包括未登录）在加密狗有效时全部功能可用；
- 拔出后 2 秒内恢复版本限制或只读；
- 无效/未写入/读取失败的加密狗不解除任何限制，并显示区别于“未插入”的提示。

### 3.4 起始页左栏

- 登录后：头像（无头像用占位图）、脱敏手机号、当前版本、有效期/过期时间、购买/续费、商城；
  **不显示客户自行填写的企业名称**；企业授权来源以“企业授权 · 企业名”单独一行显示；
- 未登录：登录/注册入口；点击购买先登录，登录后继续购买页；
- 企业版点击购买/续费：弹窗提示“请联系管理员进行企业版续费”，不打开商城；
- 订阅状态旁的刷新图标：点击后重新读取商城会话，版本/有效期在 2 秒内更新，无需重启；成功后状态栏提示“订阅情况已刷新”；
- 个人购买点击计数：已登录 ≤3 次、未登录 ≤5 次到达 `/membership`；
- 点击商城：登录/未登录都可用；
- 登录、续费、退出后 2 秒内更新，无需重启。

### 3.5 起始页右栏

- 未登录：banner + 最近模板（最多 10 条，空态有说明）+ 公共云模板库；
- 登录：banner + 最近模板 + “云模板”（仅当前账号）；
- 每条云模板显示示意图（后端从正文生成的 SVG data URL）；审核端同一字段可见；
- 云模板加载失败：可重试，banner 与最近模板不受影响；
- 登录态切换后右栏立即切换，最近模板不丢失。

### 3.6 离线

- 断网启动：订阅未到期 → 可编辑；订阅已到期 → 只读；
- 断网且访问令牌已到期：刷新失败属于网络失败，必须保留凭据与快照，不得清除登录态；
- 从未成功校验过订阅 → 只读；
- 加密狗不受离线快照影响。

## 4. 真实环境人工验收

1. 准备标准版、专业版、企业版三个测试账号（或后台调整订阅），分别登录；
2. 对照 `data-model.md` 的 `FEATURE_MATRIX` 逐项检查受限功能；
3. 使用厂商工具写入授权后插入加密狗：确认全部功能解锁；
4. 拔出加密狗：确认 2 秒内回到版本限制或只读，未保存内容仍在；
5. 在商城完成一次购买/续费：确认返回应用后版本与有效期更新；
6. 检查日志与界面：无完整手机号、无授权凭据明文。

## 5. 回归与完成标准

- 起始页首屏：从启动到本地内容可见 ≤2 秒（断网时 banner/最近模板仍可用）；
- `npm test`：全部 unit/contracts/integration 通过；
- `npm run test:e2e`：全部 Playwright 通过（含新增只读/起始页/授权注入用例）；
- `npm run build`：通过；
- `tests/INDEX.md` 已更新；
- 打包构建不读取 `MAXLABEL_TEST_ENTITLEMENT`（单测锁定）；
- D-01 矩阵、D-02 厂商读取接口、商城公司名/头像/版本字段、公共模板匿名读取均在发布前确认到位或明确降级。

## 6. 常见问题

| 现象 | 排查 |
|------|------|
| 一直只读 | 检查登录订阅是否有效、加密狗读取 reason、离线快照是否已到期 |
| 加密狗插入无反应 | 确认测试注入未开启、卷标/序列号配置匹配、系统命令可读取该设备 |
| 未登录看不到公共模板 | 公共模板接口仍要求登录；此时应显示登录引导（预期降级） |
| 保存被拒但界面可编辑 | 检查主进程保存校验与 `entitlement:status` 是否一致，记录为缺陷 |

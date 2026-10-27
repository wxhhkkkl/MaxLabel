# Quickstart: 桌面端在线更新链路

**Feature**: `018-online-update` | **Date**: 2026-10-27

本指南用于实现后验证。契约见 [update-ipc.md](contracts/update-ipc.md) 与 [update-feed.md](contracts/update-feed.md)，状态机与字段见 [data-model.md](data-model.md)。

## 1. 前置条件

- Node.js ≥ 22.12、npm；`cd app && npm install`
- `electron-builder` 可构建当前平台；发布验证另需三端机器/CI
- 正式 feed：`https://new.yuwangchenfa.com/updates/`（测试使用 staging feed，**不得**把测试包发到正式 feed）
- 签名材料（仅发布/真实安装验证需要）：
  - Windows 代码签名证书
  - macOS Developer ID + 公证凭据
  - Linux 无强制签名，但需产物校验和

## 2. 自动化验证

```bash
cd app
npm test                 # typecheck + unit/contracts/integration
npm run build            # 主进程/preload/renderer 构建
npm run test:e2e         # 含 update-flow.spec.ts（mock 更新适配器）
```

`update-flow.spec.ts` 使用非打包测试适配器 `MAXLABEL_TEST_UPDATE` 模拟：

- `available` / `latest` / `error`
- `progress`（推进到 100%）
- `ready` / `install-requested`
- 启动设置开/关、手动检查、取消、未保存确认

**它不执行真实安装器、不退出应用**；真实安装/重启见第 3–5 节。

## 3. 本地/测试 feed 与 UI 流程（不安装）

目的：验证检查、提示、进度、取消、错误、设置，不触碰真实安装。

1. 以非打包模式启动，设置测试适配器：
   ```bash
   cd app
   MAXLABEL_TEST_UPDATE=available npm run dev
   ```
2. 预期：
   - 起始页可用后 10 秒内出现更新提示，包含当前/最新版本与发布说明
   - 点「立即更新」→ 显示进度；点取消 → 停止、回到可用状态，不安装
   - 模拟 `ready` 后，若存在未保存标签页，出现保存/放弃/取消；取消则保持待安装
3. 设置验证：
   - 在「系统选项 → 常规」勾选「不提示更新」→ 连续启动 10 次，0 次检查/提示
   - 从菜单「帮助 → 查找更新版本」手动检查 → 仍能看到 available/latest/error
4. 失败验证：将测试适配器切到 `error`/`bad-checksum`/`404`，手动检查必须显示原因；启动检查保持静默，软件正常可用。

> 非打包模式的 `electron-updater` 不负责真实安装；真实下载/安装必须用打包产物 + staging feed。

## 4. Windows 真实更新（NSIS）

1. 构建并安装旧版本（例：1.0.22）；保留安装包。
2. 把 `app/package.json` 版本提升到 1.0.23，构建 staging 产物：
   ```bash
   cd app
   npx electron-builder --win nsis --publish never \
     --config.publish.provider=generic \
     --config.publish.url=https://new.yuwangchenfa.com/updates-staging/
   ```
   确认 `release/` 生成 `latest.yml`、`MaxLabel-Setup-1.0.23.exe`、`.blockmap`。
3. 上传产物到 staging feed（`publish-update.cjs` 或手工），确认 `latest.yml` 的 `sha512`/`size` 与实际文件一致。
4. 启动已安装的 1.0.22 → 出现提示 → 立即更新 → 进度 → 自动安装/重启 → 版本显示 1.0.23。
5. 重复验证：
   - 取消下载：不安装，当前版本继续可用
   - 未保存标签页：保存/放弃/取消；取消不重启、不丢内容
   - 打印/预览/导出中：不重启，稍后可「立即重启」
   - 设置「不提示更新」：启动不检查；手动检查仍可用
   - 破坏 `sha512`/删除安装包：拒绝安装并保留当前版本

## 5. macOS / Linux 真实更新

### macOS

1. 使用 Developer ID 签名并公证 1.0.23；构建 `dmg` + `zip`：
   ```bash
   cd app
   npx electron-builder --mac dmg zip --publish never \
     --config.publish.provider=generic \
     --config.publish.url=https://new.yuwangchenfa.com/updates-staging/
   ```
2. 安装 1.0.22 → 检查 → 下载 → 安装 → 自动重启 → 版本 1.0.23。
3. 未签名/未公证的包必须验证会被拒绝或无法安装；记录实际提示。

### Linux

1. 构建 `AppImage`（自动更新）与 `deb`（手动）：
   ```bash
   cd app
   npx electron-builder --linux AppImage deb --publish never \
     --config.publish.provider=generic \
     --config.publish.url=https://new.yuwangchenfa.com/updates-staging/
   ```
2. 以 AppImage 运行 1.0.22（可执行权限）→ 检查 → 下载 → 安装 → 重启 → 版本 1.0.23。
3. 验证 AppImage 所在目录可写；不可写时必须提示失败，当前版本继续可用。

## 6. 三端一致性检查（SC-011）

每端至少完成一次：

- [ ] 启动检查（有更新/无更新/断网）
- [ ] 手动检查（available/latest/error）
- [ ] 下载进度、取消、重试
- [ ] 安装/重启，版本号更新
- [ ] 未保存内容取消重启，内容保留
- [ ] 设置「不提示更新」后启动不检查，手动检查仍可用
- [ ] 校验失败/404/权限不足，当前版本仍可用
- [ ] 用户数据/模板/设置/授权保留

## 7. 明确不自动化 / 不验证项

| 项 | 原因 | 处理 |
|----|------|------|
| 三端真实安装器执行与重启 | 会改动测试机、依赖签名/公证/OS 权限 | 人工按 §4–§6 验证并记录 |
| Windows 代码签名 / macOS 公证 / 提权 | 依赖发布证书与 OS 交互 | 发布前人工验证；未签名包不得进正式 feed |
| 杀毒软件拦截、磁盘满、网络中断 | 环境相关、不可稳定复现 | 人工模拟并记录；自动化覆盖错误映射 |
| 自动回滚 | 本期明确不做（见 spec Clarifications） | 手动重装上一版本，见 update-feed §4/§7 |
| 差分下载优化 | 本期按全量包验收 | 如启用 blockmap，不得改变行为/失败处理 |
| 真实支付/授权/模板数据迁移 | 不属于更新链路 | 更新前后人工抽查用户数据 |

## 8. 实测记录（2026-10-27）

**已自动化验证**

- `npm test`：125 个测试文件 / 769 条用例通过（含 update service、feed config、startup 设置、update IPC）
- `npx playwright test tests/e2e/update-flow.spec.ts`：6 条通过（启动提示、latest 静默、error 手动提示、下载取消/恢复/ready/install、校验失败、关闭启动检查后手动检查仍可用）
- `node scripts/build-dir.cjs`：Windows 目录包成功；打包后的 `MaxLabel.exe` 能在隔离 `APPDATA` 下启动并显示起始页
- `node scripts/build-windows.cjs`：生成 `release/latest.yml` 与 `release/win-unpacked/resources/app-update.yml`（generic feed）
- `node scripts/publish-update.cjs --release release --target-dir release/updates-staging --feed ...`：SHA-512/大小/相对 URL 校验通过，产物与旧版 `version.json` 已暂存

**待人工验证（未执行）**

- Windows/macOS/Linux 真实安装包 → 检查 → 下载 → 安装 → 重启（T050–T052）
- Windows 代码签名、macOS 签名/公证、Linux AppImage 可写路径/提权
- staging feed 上传与真实网络条件（10 Mbps/≤200 MB/≤5 分钟）
- 杀毒软件拦截、磁盘满、真实提权失败

以上未验证项不会用自动化结果冒充；需要在有签名证书、staging feed 与三端机器的环境中按 §4–§6 补测。

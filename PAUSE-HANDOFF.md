# 暂停交接说明（验收方 round-141 写，用户要求"执行完这轮暂停"）

时间：2026-09-21 19:05（本地）

## 一、现在是什么状态

| 项 | 值 |
| --- | --- |
| 循环 | **已按优雅方式暂停**：`tools/loop/STOP` 已放置 → 驱动器会在**当前轮（round 120）结束、把 claude 的在途改动提交后**退出；自动切换监管器已停（不会再自动拉起） |
| 当前 agent | **claude**（round 120 进行中；它正在做"小改清单"①②③ 并同步改断言） |
| `state.json` | round 120、`consecutiveFail=0`、`lastGoodSha=944625d…` |
| codex | **额度耗尽**（19:02 触限，本轮只跑 15 分钟、27.8 万 tokens）→ 我按自适应策略把冷却设为 **+90 分钟（今晚 20:34 重试）**；但循环一停，这个重试也不会发生 |
| 未收口差异 | **6 条**：DIFF-60（观察项）、DIFF-63（代码已改，待复核）、DIFF-65（RFID 入口决策）、DIFF-68（打印机页开关形态）、DIFF-70（打印输出空白，待取证）、DIFF-71（仅剩"界面语言按原版有但受限登记"） |
| 四件套（P4） | 真机证据 72（11.9%）／复刻证据 255（42.1%）／并排图 27（4.5%）／断言 485（80.2%）／**四件套齐 20（3.3%）**；引用存在性 **102/102** ✓ |
| 发布 | **v1.0.19 是当前已发布版**；**v1.0.20 未打包**（发布说明草稿已在库：`RELEASE-NOTES-v1.0.20.md`，SHA256 待打包后自核填入） |

## 二、恢复怎么做（两条命令）

```powershell
# 1) 删掉 STOP（不删的话监管器/驱动器一启动就会退出）
Remove-Item D:\workspace\maxlabel\tools\loop\STOP -Force

# 2) 重新拉起额度自动切换监管器（codex 优先，触限自动切 claude）
Start-Process -FilePath 'powershell' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass',
  '-File','D:\workspace\maxlabel\tools\loop\Start-Loop-Auto.ps1',
  '-BatchRounds','12','-MaxTotalRounds','240','-StartAgent','codex','-Repo','D:\workspace\maxlabel' `
  -WorkingDirectory 'D:\workspace\maxlabel' -WindowStyle Hidden
```
启动后用 `tools/loop/logs/auto-switch-*.log`（最新那个）确认它选了哪个 agent ✓。

## 三、恢复后第一件该做的事（按优先级）

1. **复核 claude round 120 的三项小改**（分享 `(T)` / `类型(I):` / 去掉空云盒红色阻断校验）：
   重出同态并排图 `menu` 与 `printerportbox`（`tools/parity/New-ParityShot.ps1 -Round <n> -Scenes menu` 等），
   再跑断言强度抽验（`git diff` 看 ui 脚本的 `results[...]` 增删）；
2. **打包 v1.0.20**：`powershell -File tools/parity/Release-Clone.ps1 -Version 1.0.20`
   （自带三道前置：无 electron、工作区干净、产物不存在；会自动改版本号、打包、**自算 SHA256** 并登记）；
   随后把 SHA256 填进 `RELEASE-NOTES-v1.0.20.md` 并提交推送；
3. **P4 继续**：`login` 场景已备好（账户菜单 → 登录）；「只缺并排图」的行已不多；
4. **20:34 之后**：若想再用 codex，确认它的冷却是否已到期（`%TEMP%\maxlabel-loop-auto\agent.json`）。

## 四、本次暂停时**没有**遗留的脏状态

- 我的改动全部已提交并推送（与 `origin/main` 一致）✓；
- 真机（LabelShop）**已关闭** ✓；没有我遗留的 electron 实例 ✓（当前 electron 是循环自己的 UI 回归 ✓，会随它退出而结束 ✓）；
- `STOP` 是**唯一**留下的"控制文件"，恢复时删掉即可 ✓。

# P0 断言覆盖审计（验收方 round-87）

**目的**：确认 P0（用户实测反馈的那条线：选择纸张的「自定义」形态 + 各种纸张的圆角弧度）**每一条要求都有机器可跑的检查**，
且**验收方工装与循环脚本两侧都有**（防止"只在一边钉住、另一边悄悄漂移"）。

## 一、逐条映射

| P0 要求 | 验收方工装（`tools/parity/Verify-LabelFormatDialog.cjs`） | 循环侧脚本 | 结论 |
| --- | --- | --- | --- |
| `标签名称(L)` 下拉**不含「自定义」** | ① | `ui-v129`「C-76 标签名称下拉共 42 项且没有自定义项」 | ✅ 两侧 |
| 「自定义(N)」打开**四页签**「标签格式设置」 | ② | `ui-v129`「C-81 自定义入口标题与四页签顺序匹配真机」 | ✅ 两侧 |
| 五个分组框 `标签/间距/行列/形状/孔洞` | ③ | `ui-v130`「分组框恰好为 标签/间距/行列/形状/孔洞」 | ✅ 两侧 |
| 字段名 = 真机原文（含加速键） | ④ / ④b | `ui-v129`/`ui-v130`（「标签字段使用真机加速键名称」） | ✅ 两侧 |
| **无「圆角半径」字段** | ⑧ | `ui-v129`/`ui-v130`（「标签页没有圆角半径输入」） | ✅ 两侧 |
| `形状` 3 项 = `方角矩形/圆角矩形/圆形` | ⑤ / ⑤b（逐字） | `ui-v131`（两个入口逐字） | ✅ 两侧 |
| `孔洞` 3 项 = `无/圆洞/矩形` | ⑤ / ⑤b（逐字） | `ui-v129`/`ui-v130`/`ui-v131` | ✅ 两侧 |
| `应用(A)` 按真机**隐藏** | ⑥ | `ui-v130`（「存在、禁用、不可见」） | ✅ 两侧 |
| 预览行 `100.00 x 70.00 毫米 [4行 2列]` | ⑦ | `ui-v129`/`ui-v130` | ✅ 两侧 |
| **矩形孔真的画出矩形切孔**（行为级） | ⑨ | `ui-v130`「追加4」 | ✅ 两侧 |
| **圆洞尺寸>0 画弧线切孔 / =0 不画**（行为级） | ⑩ | `ui-v130`「追加4」 | ✅ 两侧 |
| 圆角半径 = 固定 **1mm**，四条绘制路径一致 | `measure-paper-radius.cjs`（100×70 / 100×150 / 60×60 / 40×30 全 1mm；显式 2mm 保留；直角 0） | `test:render`（`roundRect preview path uses the shared 1mm arc`、`renderLabel clips the default roundRect corner with the shared radius`） | ✅ 两侧 |
| 两个入口（选择标签格式 / 工具栏）**同一套选项**（防漂移） | —（由循环侧覆盖） | `ui-v131`「两个入口的形状/孔洞选项逐字相同（单一来源）」 | ✅ 循环侧 |

## 二、结论

- P0 的**每一条**都有断言，且**11/13 条两侧都有**（剩下 2 条一侧覆盖：半径量测与"单一来源"）。
- 实测状态：验收方工装 **17/17 PASS**（round-81 复跑）；循环门禁 **round-105…113 全量 test:ui 全绿**。
- 因此 P0 这条线可以判定为**"已实现 + 有证据 + 有两侧断言"**，不再是待办；
  唯一遗留的是我在 round-80 用并排图新发现的「自定义对话框预览缺拼版网格」——那属于**新登记的差异**（见 `round-focus.md`），不否定本条结论。

## 三、复跑方法

```powershell
# 验收方工装（自带实例，不占循环的 test:ui 锁）
$exe = "D:\workspace\maxlabel\app\node_modules\electron\dist\electron.exe"
Start-Process $exe -ArgumentList '.','--remote-debugging-port=9333',"--user-data-dir=$env:TEMP\maxlabel-verifier-profile" -WorkingDirectory "D:\workspace\maxlabel\app"
$env:MAXLABEL_DEBUG_PORT='9333'; node tools\parity\Verify-LabelFormatDialog.cjs
node tools\parity\measure-paper-radius.cjs
Get-CimInstance Win32_Process -Filter "Name='electron.exe'" | Where-Object { $_.CommandLine -like "*maxlabel-verifier-profile*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

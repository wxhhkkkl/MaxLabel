# P4 四件套：第一张「当轮构建」并排图（验收方 round-62）

## 这次做了什么

把 P4 的流水线跑通了**一遍**，产出第一张**用当前构建重抓**的并排图（此前的并排图全是 09-14～09-17 的旧图）：

| 件 | 文件 | 说明 |
| --- | --- | --- |
| ① 真机图 | `parity/reference/labelshop/verifier-r43-choose-label.png` | 真机「选择标签格式」（round-43 验收方实拍，934×1000） |
| ② 复刻图 | `parity/reference/maxlabel/clone-choose-label-r112.png` | 复刻版同一对话框（**round-112 构建**，用新工装 `Capture-CloneShot.cjs --scene choose` 采集，168 873 B） |
| ③ 并排图 | `parity/review/cmp-choose-label-r112.png` | `Compare-SideBySide.ps1` 拼接（2327×940，左真机/右复刻） |
| ④ 断言 | `tools/parity/Verify-LabelFormatDialog.cjs` 的 ①–⑩ | 对同一对话框的机器可跑检查，**本轮 17/17 PASS** |

## 肉眼可见的一致点（并排图核对）

标题「选择标签格式」；预览 8 格 + `100mm`/`70mm` 标注；`纸张: 210 毫米 X 297 毫米`；`标签: 100.00 毫米 X 70.00 毫米`；
分组「选择标签」含 `打印机(P)` / `标签品牌(B)` / `标签类型(G)` / `标签名称(L)` 与 `安装(I)`；
提示语「如以上列表中没有尺寸适合的标签格式，请点击"自定义"，自行设置标签的尺寸。」；
底排 `选择(O) / 自定义(N) / 取消(C) / 帮助(H)`。

## 复跑方法（一条命令一行）

```powershell
# 1) 起一个独立实例（自己的 profile + 端口，不进循环的回归锁）
$exe = "D:\workspace\maxlabel\app\node_modules\electron\dist\electron.exe"
Start-Process $exe -ArgumentList '.','--remote-debugging-port=9333',"--user-data-dir=$env:TEMP\maxlabel-verifier-profile" -WorkingDirectory "D:\workspace\maxlabel\app"
# 2) 出复刻图 / 跑断言
node tools\parity\Capture-CloneShot.cjs --port 9333 --scene choose --out parity\reference\maxlabel\clone-choose-label-rNNN.png
$env:MAXLABEL_DEBUG_PORT='9333'; node tools\parity\Verify-LabelFormatDialog.cjs
# 3) 拼并排图
powershell -File tools\parity\Compare-SideBySide.ps1 -Left parity\reference\labelshop\verifier-r43-choose-label.png -Right parity\reference\maxlabel\clone-choose-label-rNNN.png -Out parity\review\cmp-choose-label-rNNN.png
# 4) 收摊（只杀自己 profile 的进程）
Get-CimInstance Win32_Process -Filter "Name='electron.exe'" | Where-Object { $_.CommandLine -like "*maxlabel-verifier-profile*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

## 下一批要补的四件套（建议顺序）

1. 「标签格式设置（自定义）」— 真机图 `verifier-r44-hole-circle-20b.png` 已有，复刻图用 `--scene custom` 抓；
2. 「对象属性 — 文字/条码」— 需要先校准 `Verify-ObjectTabs.cjs`（建对象＝选工具后**点画布落点**，已查明；双击对象用 CDP 真实鼠标）；
3. 「系统设置」四页 — 真机图 round-112 已拍全（`probe-r112-sysset*.png`），复刻图待 DIFF-71 落地后再抓（否则并排图会拍出"3 页 vs 4 页"的已知差异）。

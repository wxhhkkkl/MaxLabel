本轮做 **P0-A：起始页精修**（不要跨模块）。依据 `parity/reference/labelshop/START-PAGE-SPEC.md`（从真机自带起始页 HTML/CSS 解析出的规格）+ `parity/diffs.md` 的 DIFF-2 细分表，并且**以真机截图放大件为准**：`parity/review/real-startpage-left.png`（左栏 2 倍放大，我已逐字核对）、`parity/reference/labelshop/00-main.png`。

## 真机左栏的确切内容与顺序（我已 2 倍放大逐字核对，照抄即可）

```
[吉祥物头像图（圆形，卡通马）]
未登录
────────────────────────────
0            0            0
优惠券      待支付订单    待收货订单
[ 标签商城 ]  [ 新手入门 ]        ← 蓝底按钮
开始                        云马通首页   ← 「开始」蓝色加粗；「云马通首页」橙色、右对齐
客服1QQ：1669809392
客服2QQ：3395913685
客服电话：4000-987-360
新建标签模版                      ← 注意是「模版」不是「模板」
打开标签模版
打开本机模版
下载云马通APP                     ← 橙色
最近
test                            ← 最近文件列表项（本地 RecentFile 数据源）
```

**要点**：客服三行在「新建/打开」四项**之前**；四项用「模版」；`下载云马通APP` 是橙色链接样式；`最近` 与 `开始` 是蓝色标题样式；`云马通首页` 橙色且与「开始」同一行。

## 逐条收口（改完勾掉 `parity/diffs.md` 的 DIFF-2.x，并在 `parity/matrix.md` 标状态+证据）

| 子项 | 复刻版现状 | 要求 |
| --- | --- | --- |
| 2.1 左栏顶部 | 多出 `MaxLabel` 品牌标题行 | 去掉品牌标题行，改成吉祥物头像图 + `未登录`（登录态显示账号） |
| 2.2 计数格 | 基本一致 | 文案用原文：`优惠券` / `待支付订单` / `待收货订单` |
| 2.3 `开始` 列表 | 6 项、缺客服 2 行、把电话当成 QQ | 按上面 7 行原文与顺序；用「模版」 |
| 2.4 客服三行 | 独立「客服」块 | 归位到 `开始` 列表内，文案/顺序照抄 |
| 2.5 `最近` | `暂无最近模板` | 接本地最近文件（`RecentFile` 数据源）；空态与有数据两种状态都要能显示 |
| 2.6 右区结构 | 欢迎标题 + 3 功能卡 + 模板库 + 最近打开 + 最新文章 | 按原版分区：顶部广告位（`{$TOPLINK}`）+ `最新文章` + 下载块；运营图文是**服务端下发位图**，用等价自制素材占位，矩阵注明「等价替代」 |

## 硬性要求

1. 起始页入口要真的接线（规格有完整清单）：`LabelShop:NewDocument` / `OpenDocument` / `OpenDocument:<路径>` / `OpenLocal` / `OpenCodingV` / `OpenULogin:<URL>` / `OpenUrl:<URL>` / `labelshop:UserLogin`。复刻版不用该协议也行，但要用内部等价回调实现同样行为，保证「开始」每一项都能点出对应功能。
2. 视觉风格可用复刻版自己的，但**分区位置、条目文案、条目顺序、可点行为**必须与上面一致。
3. 新增 CDP 断言（`app/scripts/ui-vNN.cjs`，挂进 `app/scripts/run-regression.ps1`）：断言左栏顶部无品牌标题行、`开始` 列表 7 行文字与顺序（含「模版」与三行客服号码）、`最近` 列表空态/有数据、右区分区块存在。
4. 改完重抓复刻版截图：`powershell -File tools/parity/MaxLabelCtl.ps1 -Action run -Scenario tools/parity/scenarios/main.json`（产物 `parity/reference/maxlabel/00-main.png`）。
5. 边做边提交；提交前 `powershell -File tools/parity/Check-Matrix.ps1` 必须 exit 0。不要改 `parity/reference/labelshop/` 下证据文件，不要改 `tools/parity/LabelShopCtl.ps1`。

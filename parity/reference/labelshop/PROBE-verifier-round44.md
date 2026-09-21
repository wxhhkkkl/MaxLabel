# 验收方 round-44 真机取证：**真机会画孔**（推翻 round-107b 的"取不到像素证据"）

日期：2026-09-21（循环 round 109 期间）。真机：签赋 LabelShop V6.39 标准版-未激活。

## 一、结论（两处都画，证据是截图）

| 场景 | 真机行为 | 证据 |
| --- | --- | --- |
| **「标签格式设置」对话框预览** | **画孔**：8 个卡片中心各有一个小圆（孔），编号落在孔里 | `verifier-r44-hole-circle-20b.png` |
| **编辑器画布**（点确定后） | **画孔**：100×70mm 标签中心有一个青色圆（= 20mm 孔，工作区颜色透出） | `verifier-r44-editor-hole20.png` |

配置：`形状=圆角矩形`、`孔洞=圆洞`、`孔洞尺寸=20`（由 `Read-LabelShopDialogValues` 回读确认 `value='20'`）。

## 二、为什么 round-107b 会得出"不画孔"的错误结论

它测试时**孔洞尺寸始终是 0.00**（`无`→禁用、切到 `矩形/圆洞` 后默认 `0.00`），
尺寸注入又没真正生效（它用 `WM_SETTEXT`+`EN_CHANGE`，回读能到 20 但预览没变——很可能值没提交到模型），
于是把"没有孔"归因成"真机不画孔"。**实际原因是孔尺寸为 0**。

## 三、可复现的注入手法（这次成功的关键）

1. 冷启动 → 向导 → `自定义(N)` 进入「标签格式设置」（配方见 `PROBE-verifier-round43.md`）。
2. `Probe-LabelShopCombos.ps1 -TitleLike '*标签格式设置*' -SetCombo 0 -SetIndex 1` → `孔洞=圆洞`（**尺寸框随即变为 enabled**）。
3. `LabelShopCtl.ps1 -Action list` 取对话框矩形（本次 `1065x948 at (748,290)`），
   用 `Read-LabelShopDialogTree.ps1` 取控件屏幕坐标，换算成**对话框内坐标**：
   宽度 Edit 屏幕中心 `(960,970)` ⇒ `clickdlg:212,680`；孔洞尺寸 Edit 屏幕中心 `(1375,1105)` ⇒ `clickdlg:627,815`。
4. `clickdlg:<x>,<y>` 点中字段 → `keydlg:^a` 全选 → `keydlg:20` 输入 → **`Read-LabelShopDialogValues.ps1` 回读确认**。
5. 截图对话框（看预览）→ `btn:确定` → 截图编辑器（看画布）。

**踩过的坑（本轮记录）**：`postclick:` 只能给**主窗口的子窗口**发 WM_LBUTTONDOWN，不能点对话框里的控件（参数格式还是 `<class>|<x>,<y>`）；
`keydlg:{TAB}` 会打偏（第一次把 20 打进了「高度」）；**注入前必须先 `clickdlg:` 点中目标字段**。

## 四、仍未取证的一点

帮助 `label_page_label.html` 说「标签的形状与孔洞**只在编辑标签时显示，并不会实际输出**」。
现在已证"编辑时显示"（预览+画布都画），但**打印输出里到底有没有孔**还没验：
需要把该标签**打印到 Microsoft Print to PDF**，再把 PDF 渲染成位图逐像素看中心（不能只看 PDF 文本流）。

## 五、本轮产物

| 文件 | 内容 |
| --- | --- |
| `verifier-r44-hole-circle-20b.png` | 对话框预览**画孔**（8 个卡片中心有圆）+ 字段值 100/70/圆洞/20 |
| `verifier-r44-editor-hole20.png` | 编辑器画布**画孔**（中心青色圆） |
| `tools/parity/steps/verifier-hole-scene-{6,7,8}.txt` | 本次注入与截图的步骤 |

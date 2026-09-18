# round-104 真机取证记录（启始页菜单栏 / 模板向导 / 标签格式联动）

- **日期**：2026-09-18
- **对象**：`C:\Program Files (x86)\LabelShop\LabelShop\LabelShop.exe`（签赋 LabelShop 标准版 - 未激活 V6.39）
- **工装**：`tools/parity/LabelShopCtl.ps1`（`start` / `run` / `shot` / `list`）、`parity/reference/labelshop/_enum.ps1`、`_click.ps1`、`_fgkeys.ps1`，以及本轮新增的 `tools/parity/Probe-LabelShopCombos.ps1`（只读窗口消息，读取对话框内 ComboBox 的条目列表）
- **产出**：
  - `probe-01-newlabel.png`：启始页全屏（2582x1550，物理像素）
  - `probe-05-wizard2.png`：模板向导第 2 页「选择标签格式」
  - `probe-printer-link-hp.txt`：把「打印机」下拉从 `Microsoft Print to PDF` 切到 `HP7E6C81 (HP LaserJet Pro M329)` 前后的四组下拉条目对照

---

## 1. 启始页菜单栏 = 12 个顶层菜单（DIFF-36 的真机依据）

`probe-01-newlabel.png` 菜单栏自左至右：

`文件(F)` `编辑(E)` `查看(V)` `工具(T)` `排列(A)` `数据库(D)` `账户(A)` `云马通(C)` `选项(O)` `窗口(W)` `帮助(H)` `建议与反馈`

与编辑态基线 `40-editor.png` 的菜单栏**逐项一致**。两态差别：
1. 启始页的「文件(F)」是启始页专用列表（新建 / 新建条幅飘带 / 打开… / 打印设置… / 最近的文件 / 退出），没有保存、打印预览一类文档命令；
2. 其余菜单里依赖文档的条目（编辑、工具、排列、数据库、窗口的绝大多数）在启始页**变灰**。

→ 复刻版原先在启始页只列 7 个顶层菜单，已按此修复（`parity/diffs.md` DIFF-36、`app/scripts/ui-v118.cjs` 9/9）。

## 2. 模板向导（启动即弹）

- 启动顺序：`管理软件许可` 对话框（804x601）→ `模板向导`（804x513）。未激活状态下每次启动都会出现。
- 第 1 页：`打开一个现有的标签模板` / `新建标签模板`（默认选中） / `查看 LabelShop 联机帮助` / `查看 LabelShop 在线使用教程` / `下次启动时不再使用向导` + `下一步` / `取消`。
- 第 2 页标题为 `选择标签格式`，控件（真机坐标，物理像素）：

| 控件 | class | 内容 |
| --- | --- | --- |
| 打印机(P) | ComboBox | `HP7E6C81 (HP LaserJet Pro M329)` / `Microsoft Print to PDF` / `OneNote (Desktop)`（默认选中第 2 项） |
| 标签品牌(B) | ComboBox | `京成云马标签 (平张标签)` / `普林泰科标签 (平张标签)` |
| 标签类型(G) | ComboBox | `云马优质打印纸标签`（仅 1 项） |
| 标签名称(L) | ComboBox | 42 项，形如 `[608051] 210mm x 297mm 直角1枚/页 20页/盒` |
| 说明行 | Static | `标签：  100.00 毫米 X 70.00 毫米`、`纸张：  210 毫米 X  297 毫米` |
| 按钮 | Button | `选择(O)` / `自定义(N)` / `帮助(H)` / `取消(C)` / `安装(I)` |

## 3. 「标签品牌是否与打印机联动」实测

做法：用 `tools/parity/Probe-LabelShopCombos.ps1` 先读四组下拉条目，再对「打印机」下拉 `CB_SETCURSEL` 到第 1 项（HP 激光打印机）并向父窗口投递 `WM_COMMAND(CBN_SELCHANGE)`，1.5 秒后重读。

结果（`probe-printer-link-hp.txt`）：

| 下拉 | 切换前 | 切换后 |
| --- | --- | --- |
| 打印机 | `Microsoft Print to PDF`（sel=1） | `HP7E6C81 (HP LaserJet Pro M329)`（sel=0，**已生效**） |
| 标签品牌 | 2 项（京成云马标签 / 普林泰科标签） | 2 项，**不变** |
| 标签类型 | 1 项（云马优质打印纸标签） | 1 项，**不变** |
| 标签名称 | 42 项（[608051]…） | 42 项，**不变** |

**结论（有保留）**：本机安装的三台打印机全部是**普通打印机**（HP 激光、Microsoft Print to PDF、OneNote），没有标签打印机 / 卷筒打印机，因此即使原版按「只列出打印机支持的品牌」过滤，三个品牌列表也没有可差异化的样本。用本机条件**无法证实也无法证伪**清单里「标签品牌随打印机联动」这一条。

可确认的是：品牌 / 类型 / 名称三个下拉的内容来自标签格式库 `LabelFormat360.fmt`（SQLite，275 行，见 `LABEL-FORMAT-SPEC.md`），不是从打印机驱动实时枚举出来的；打印机下拉的候选来自系统打印机列表。

**复刻版现状**：`标签属性` 对话框的「打印机」下拉列出系统打印机，标签品牌 / 类型 / 名称来自同一份标签格式库，切换打印机时按「该打印机支持的品牌」过滤（无标签打印机时列全部）。若后续要严格对齐，需要一台真实标签打印机的实例取证。

## 4. 工具限制（本轮踩到，供后续取证参考）

- 原版对 `SetCursorPos + mouse_event` 注入**不响应**（`LabelShopCtl.ps1` 内注释亦记录此点）。本轮改用：
  - 对话框按钮 → `btn:<文字>`（向 Button 发 `BM_CLICK`）；
  - 对话框内下拉 → `tools/parity/Probe-LabelShopCombos.ps1`（`CB_GETCOUNT` / `CB_GETLBTEXT` / `CB_SETCURSEL` + `WM_COMMAND`）；
  - 需要键盘的场合 → `_fgkeys.ps1`（先 `SetForegroundWindow` 再 `SendKeys`）。
- `-Action shot` 抓的是主窗口位图，**不含弹出菜单**：`Alt+F` 到底有没有打开菜单无法用截图判定，故菜单栏结论以静态截图（`probe-01-newlabel.png`）为准。
- 该进程为 150% DPI 缩放：`shot` 出的位图是物理像素（2582x1550），而 `_click.ps1 -At` 用的是 DPI-unaware 虚拟坐标（约 ÷1.5）。

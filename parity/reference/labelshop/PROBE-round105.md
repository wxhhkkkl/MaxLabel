# round-105 真机取证记录（安装打印机对话框 / 卷筒标签联动）

- **日期**：2026-09-18
- **对象**：`C:\Program Files (x86)\LabelShop\LabelShop\LabelShop.exe`（签赋 LabelShop 标准版 - 未激活 V6.39）
- **触发**：用户实测反馈——「打印机安装逻辑和原来 LabelShop 的逻辑完全不一样」「现在无法删除打印机」「选择打印机后卷筒标签的展示和原来不一样」
- **产出**：
  - `probe-06-select-format.png`：选择标签格式页（安装前）
  - `probe-07-install-printer.png`：「安装 LabelShop 打印机」对话框全貌
  - `probe-08-install-list.txt`：可安装打印机列表**全部 125 行**（含「状态」列）
  - `probe-10-install-filter.txt`：品牌过滤下拉**全部 39 项**
  - `probe-09-roll-after-select.txt`：把打印机从 `Microsoft Print to PDF` 切到 `Gprinter GPL-N (203 dpi)` 前后，品牌/类型/名称三个下拉的对照
  - `uia-107-install-printer.txt`：该对话框的 UIA 树（辅助确认控件层级）
- **本轮新增工装**（都在 `tools/parity/`）：
  - `Read-LabelShopListView.ps1`：跨进程读 `SysListView32` 全部行（`VirtualAllocEx` + 32 位 `LVITEMW` + `LVM_GETITEMTEXTW`），可 `-SelectRow` 选中某行
  - `Invoke-LabelShopButton.ps1`：用 `PostMessage(BM_CLICK)` 点按钮——点「安装」这类会弹模态的按钮时，`SendMessage` 版会被阻塞到模态关闭
  - `Dump-LabelShopUia.ps1`：按标题 dump 某个窗口的 UIA 控件树

---

## 1. 「安装 LabelShop 打印机」对话框结构（真机）

```
标题：安装 LabelShop 打印机                     [×]
 可安装的打印机：
 [ 全部                                            ▾ ]   ← 品牌过滤，39 项（全部 + 38 品牌）
 ┌───────────────────────────────────────┬──────────┬──────┐
 │ 打印机                                │ 状态     │      │   ← SysListView32，125 行
 │ Gprinter GPL-N (203 dpi)              │ 已安装   │      │
 │ Gprinter GPL-N (300 dpi)              │          │      │
 │ …                                     │          │      │
 │ Argox PPLB-N (600 dpi)                │          │      │
 └───────────────────────────────────────┴──────────┴──────┘
 安装 LabelShop 打印机，可以在LabelShop中实现一般的标签打印功能。如果想充分发挥打印机的性能，请安装官方提供的驱动程序。
 [ 安装 ] [ 移除 ] [ 帮助 ] [ 返回 ]
```

- **按钮**：`安装` / `移除` / `帮助` / `返回` 四个；未选中行时 `安装` 与 `移除` 都是**灰的**。
- **「状态」列**取值为空或 `已安装`。
- **动作对象是列表的当前行**：`安装` 把该行登记为已安装并写 `状态=已安装`；`移除` 把它清回空。
  本轮实测：不选中任何行直接点「安装」，装的是**第 0 行**（`Gprinter GPL-N (203 dpi)`）→ 说明未选中时列表内部仍有当前行；
  随后点「移除」，第 0 行 `状态` 由 `已安装` 变回空，验证了移除语义。
- 品牌过滤下拉 39 项：`全部`、`斑马 (Zebra)`、`TSC / Zenpert`、`东芝泰格 (TEC)`、`普印力 (PRINTRONIX)`、`佐藤 (SATO)`、
  `实诺锐 (SONARAY)`、`川步 (Zgtrumb)`、`实达 (START)`、`佳博 (Gprinter)`、`雷丹 (Leden)`、`打印猿 (PrintMan)`、
  `中盈科技 (ZhongYing)`、`维庭 (Weiting)`、`资江 (ZIJIANG)`、`斯普瑞特 (SPRT)`、`成为 (CHAINWAY)`、`奥莱新创 (AOLXC)`、
  `科诚 (GoDEX)`、`立象 (Argox)`、`普贴 (PUTY)`、`映美 (Jolimark)`、`艾美多 (AMYDOR)`、`映之美 (iZM)`、`芝柯 (ZICOX)`、
  `Honeywell`、`容大 (RONGTA)`、`腾坤 (Towercode)`、`爱立熊 (Alison)`、`致明兴 (ZMIN)`、`瑞工 (REGO)`、`博思得 (POSTEK)`、
  `启锐/爱印 (QIRUI/IPRT)`、`美松 (MASUNG)`、`芯烨 (Xprinter)`、`汉印 (HPRT)`、`爱印互联 (AIYIN)`、`新北洋 (SNBC)`、`济强 (JQTEK)`。
- 125 行条目命名规则：`<品牌> <型号/原生指令集>-N (<dpi> dpi)`，例如
  `Gprinter GPL-N (203 dpi)`、`TSC TSPL-N (300 dpi)`、`Zebra ZPL-N (203 dpi)`、`Zebra EPL-N (203 dpi)`、
  `Argox PPLB-N (600 dpi)`、`SATO CLNX-N (305 dpi)`、`TOSHIBA-TEC TPCL-N (203 dpi)`。
  品牌分布（行数）：新北洋 10、雷丹 9、佳博 7、斑马 6、实诺锐 6、立象 6、TSC/Zenpert 5、汉印 5、芝柯 4 …
  → 复刻版把这份目录原样落成数据文件 `app/src/shared/domain/printerCatalog.generated.ts`（生成器 `app/scripts/generate-printer-catalog.cjs`）。

## 2. 安装后 → 选择标签格式页的联动（probe-09）

在对话框里装好 `Gprinter GPL-N (203 dpi)` 并点「返回」后：

| 下拉 | 装之前（Microsoft Print to PDF，平张） | 装之后选中 Gprinter GPL-N (203 dpi) |
| --- | --- | --- |
| 打印机 | 3 项系统打印机（HP 激光 / Microsoft Print to PDF / OneNote） | **4 项**：`Gprinter GPL-N (203 dpi)` 排在最前 + 原 3 项系统打印机 |
| 标签品牌 | 2 项：`京成云马标签 (平张标签)` / `普林泰科标签 (平张标签)` | **1 项**：`京成云马标签 (卷筒标签)` |
| 标签类型 | 1 项：`云马优质打印纸标签` | **7 项**：高级铜版纸标签 / 优质铜版纸标签 / 高级热敏纸标签 / 合成纸标签 / 白PET标签 / 哑银PET标签 / 优质热敏标签 |
| 标签名称 | 42 项 `[6080xx] … 20页/盒` | **31 项** `[602001] 100mm x 150mm 单列 320签/卷` … |

要点：
1. **品牌名带介质后缀**：卷筒 `京成云马标签 (卷筒标签)`、平张 `京成云马标签 (平张标签)`（半角括号 + 一个空格）。
2. 卷筒目录里品牌只有 1 个（京成云马标签），类型 7 个；平张目录品牌 2 个，默认品牌下的类型 1 个、名称 42 项。
3. 选中**平张**打印机时，标签类型**不会**混入卷筒类型（复刻版原先混了——按 `type` 过滤才是真机口径）。

## 3. 本机打印机枚举的旁证

- `Get-Printer`（Windows 打印队列）只有 `OneNote (Desktop)` / `Microsoft Print to PDF` / `HP7E6C81 (HP LaserJet Pro M329)`；
- 但复刻版 `printers:list` 通过 PnP/USBPRINT 枚举还能看到 **`Gprinter  GP-1324D`**（用户接的真实打印机，未装打印队列）。
  这与 `app/src/main/printing/commandTransport.ts` 的 `listWindowsPrinterDevices()` 设计一致，也解释了为什么「选择标签格式」页能在驱动缺失时仍列出佳博设备。

## 4. 工具限制（本轮踩到）

- **原版不响应鼠标注入**（`SetCursorPos` + `mouse_event`）。因此：
  - 点对话框按钮 → `Invoke-LabelShopButton.ps1`（PostMessage BM_CLICK）；
  - 读列表 → `Read-LabelShopListView.ps1`（跨进程读 ListView）；
  - 下拉 → `Probe-LabelShopCombos.ps1`。
- `SendMessage` 版 BM_CLICK 点「安装」会**阻塞**（模态对话框期间不返回），首轮 420s 超时即因此；改用 PostMessage 后正常。
- 本轮的 `LVM_SETITEMSTATE` 选中第 6/24 行后点「安装」，实际装的仍是第 0 行 → **原版按列表内部当前行（焦点行）安装**，
  外部设置选中态不一定改变焦点行。因此「多台打印机同时安装时的排列顺序」**本轮未能验证**，复刻版按安装顺序（先装的在前）实现并已记录。

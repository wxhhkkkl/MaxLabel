# MaxLabel v1.0.3 发布说明（打印机安装/移除 + 卷筒标签对齐）

**基线**：v1.0.2（2026-09-18）
**本次类型**：用户实测缺陷修复（打印机链路）+ 收入既有的工具栏图标配色/打印机设备枚举改动
**日期**：2026-09-20

---

## 一、用户实测的三处问题（接真实打印机 佳博 GP-1324D 后）

| 反馈 | 真机实况（本轮取证） | 复刻版修复前 |
| --- | --- | --- |
| 「打印机安装逻辑和原来 LabelShop 的逻辑完全不一样」 | 「安装 LabelShop 打印机」是**可安装打印机列表**：品牌过滤（39 项）+ 125 行列表（列 `打印机 / 状态`）+ `安装 / 移除 / 帮助 / 返回` | 自造的「品牌 + 指令集 + 分辨率 + 端口 + Windows 目标打印机 + 机型」表单 |
| 「现在无法删除打印机」 | 选中行点「移除」→ 该行「状态」清空 | 「移除」只清文档里的 printer，**不清全局偏好**；`doc?.printer ?? defaultPrinter` 回退后打印机照旧出现；起始页上更是完全没有动作 |
| 「选择打印机后卷筒标签的展示和原来不一样」 | 选中 `Gprinter GPL-N (203 dpi)` → 品牌 1 项 `京成云马标签 (卷筒标签)`、类型 7 项、名称 31 项 `[6020xx] …签/卷`；选中普通 Windows 打印机 → 品牌 2 项带 `(平张标签)`、类型 1 项「云马优质打印纸标签」、名称 42 项 `[6080xx] …页/盒` | 介质类型靠打印机名正则猜；下拉里塞了个「已安装配置：…」合成项；品牌后缀是全角 `（卷筒标签）`；平张模式用**全量目录**，京成云马标签下混进 7 个卷筒类型 |

真机取证全过程与原始数据：`parity/reference/labelshop/PROBE-round105.md`
（`probe-06-select-format.png` / `probe-07-install-printer.png` / `probe-08-install-list.txt` 125 行 / `probe-09-roll-after-select.txt` / `probe-10-install-filter.txt` 39 品牌）

## 二、改动清单

1. **打印机目录落数据**：`app/src/shared/domain/printerCatalog.generated.ts`（125 行 + 39 个品牌过滤项），生成器 `app/scripts/generate-printer-catalog.cjs`——数据就是从真机列表读出来的，不再手抄。
2. **已安装打印机偏好**：`app/src/renderer/src/features/shell/installedPrinters.ts`（`maxlabel.installedPrinters`，顺序 = 安装顺序）+ CatalogEntry → `PrinterConfig` 翻译（指令集映射 `ZPL/EPL→zpl`、`CPCL/ESCPOS→cpcl`、其余 →`tspl`）。
3. **安装对话框重写**：`PrintersInstallDialog.tsx` 变成真机的「过滤下拉 + 列表 + 状态列 + 安装/移除/帮助/返回」，未选中行时安装/移除禁用，说明文字照抄真机。
4. **选择标签格式页**：`NewLabelDialog.tsx` 打印机下拉 = 已安装的 LabelShop 打印机（在最前）+ 系统打印机；LabelShop 打印机一律按卷筒处理；品牌/类型/名称按介质类型过滤目录；品牌后缀改为半角 ` (卷筒标签)` / ` (平张标签)`。
5. **删除真的生效**：`App.tsx` 的移除同时清文档绑定与全局偏好。
6. **帮助内容归位**：指令集、未收录型号、分辨率与改选规则移到帮助主题「安装打印机」（真机里这些是帮助文档内容，对话框正文只有一句话）。
7. **`printers:list` 加固**：系统打印队列枚举失败时不再整体失败，仍返回 PnP/USBPRINT 设备枚举结果。
8. 收入工作区里既有的未提交改动（单独一次提交 `9c05fa6`）：工具栏/格式栏/对齐栏图标按分组配色（`ICON_COLORS`）；`listWindowsPrinterDevices()` 用 `Get-PnpDevice` 枚举 USBPRINT/Printer 设备——本机正是靠它才看到未装打印队列的 `Gprinter  GP-1324D`。

## 三、验证

| 门禁 | 结果 |
| --- | --- |
| 全量 UI 回归 | **70/70 脚本全过**（ui-v48 … ui-v119） |
| `ui-v119.cjs`（新增 24 条） | **24/24**：对话框结构、125 行、39 品牌、未选中禁用、安装→状态「已安装」、返回后下拉第一项、卷筒 1 品牌/7 类型/31 项、佳博 Windows 驱动也走卷筒、平张 2 品牌/1 类型/42 项、移除后状态清空且下拉不再包含、偏好被清空 |
| `ui-v82.cjs` | **15/15**（D-34~D-44 按真机重写，含帮助主题原文） |
| `ui-v72.cjs` | **8/8**（平张目录类型数 8 → 1） |
| `npm test` | exit 0（typecheck / architecture 7 / runner safety 18 / color / barcode / editor 32 / geometry / history 9 / **printer catalog（新增）** / print / render 54 / workspace） |
| `Check-Matrix.ps1` / `test:evidence` | 605/605 已实现；证据校验 599 行通过 |
| 未收口差异 | **0 条**（DIFF-1…37） |

## 四、产物

| 产物 | 路径 |
| --- | --- |
| 安装包 | `app/release/MaxLabel-Setup-1.0.3.exe` |
| 免安装目录 | `app/release/win-unpacked/` |
| 校验和 | `RELEASE-SHA256.txt` |
| 真机取证 | `parity/reference/labelshop/PROBE-round105.md` |

## 五、已知未验证项

1. 真机安装**多台** LabelShop 打印机时的下拉排列顺序：原版按列表内部焦点行安装，外部设置选中态不改变焦点行，本轮无法验证；复刻版按安装顺序（先装在前）。
2. 已安装的 LabelShop 打印机在**打印对话框**里的「位置」显示（复刻版暂时落成「指令文件」端口）。
3. 「Windows 驱动 + 打印队列」路径需要在 Windows 里装上佳博 GP-1324D 的驱动（目前只有 PnP/USBPRINT 设备）。

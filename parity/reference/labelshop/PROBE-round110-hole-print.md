# round-110 真机取证：打印链路打通到 PDF，但**输出是空白页**（P0 追加 6 的最后一步，未收口）

日期：2026-09-21（循环 round 110）。真机：签赋 LabelShop V6.39 标准版-未激活。
目标：回答「真机**打印输出**里有没有孔」（帮助 `label_page_label.html` 说形状/孔洞「只在编辑标签时显示，并不会实际输出」）。

> 命名说明：本轮次的既有文件 `PROBE-round110.md`（09-20，USB 端口/指令输出）是另一件事，故本文件另起名。

## 一、结论：**问题仍未回答**，不能据此说「输出不画孔」

拿到了打印产物，但它是**空白页** —— 页面上没有任何内容（连标签轮廓都没有），
所以「孔在不在」无从判断。**不要**把这轮的 PDF 当成"输出不画孔"的证据。

### 产物与逐字节分析

| 文件 | 内容 |
| --- | --- |
| `r110-hole-print.pdf`（835 字节，`Producer: Microsoft: Print To PDF`） | 单页；`MediaBox/CropBox = 595.32 x 841.92`（**A4**，不是 100×70mm 的标签尺寸）；`/Resources 5 0 R` 是**空字典**、**无 XObject**；`/Contents` 解压后**只有 60 字节、只有一条 CTM**：<br>`0.750000 0.000000 0.000000 -0.750000 0.000000 841.920044 cm`<br>**没有任何绘制算子**（无 `re`/`f`/`m`/`l`/`S`）。 |

即：**驱动收到了一页，但这页上什么都没画**。

## 二、已打通的部分（下轮可直接复用，别重复踩）

| 文件 | 内容 |
| --- | --- |
| `probe-r110-choose-label.png` | 冷启动向导 → 下一步 → 「选择标签格式」 |
| `probe-r110-lfs.png`、`probe-r110-lfs-values.txt` | 「自定义(N)」→「标签格式设置」；孔洞下拉 3 项 `无/圆洞/矩形`，形状 3 项 `方角矩形/圆角矩形/圆形` |
| `probe-r110-lfs-hole20.png` | 注入后：**孔洞=圆洞、尺寸=20**（`Read-LabelShopDialogValues` 回读 `value='20'`；高度仍是 70.00） |
| `probe-r110-editor-hole20.png` | 点确定 → 编辑器 100×70，**画布中心有一个 20mm 的青色圆**（= 孔），261% 缩放；右侧打印面板 `打印机: Microsoft Print to PDF` |
| `probe-r110-print-dlg.png` | 点右侧面板「打印」按钮后出现的**真机「打印」对话框** |
| `probe-r110-saveas*.png` | Windows「另存打印输出为」对话框 |

### 可复现配方

1. 进「标签格式设置」（冷启动向导 → 下一步 → 自定义(N)）：
   `powershell -File tools\parity\Invoke-LabelShopSteps.ps1 -StepsFile tools\parity\steps\probe-r110-hole-a.txt`
2. 孔洞=圆洞 + 尺寸 20（组合框用 `Probe-LabelShopCombos.ps1 -SetCombo 0 -SetIndex 1`；
   尺寸框在**对话框内坐标 (627,815)**，对话框 1065x948 at (748,290) 时与 round-44 完全一致）：
   `... -StepsFile tools\parity\steps\probe-r110-hole-b.txt`（含 `dump` 回读确认）
3. 编辑器里点右侧打印面板的「打印」按钮（**主窗口坐标 2466,655**）：
   `... -StepsFile tools\parity\steps\probe-r110-print-a.txt`
4. 另存为 PDF（**新工具**，见下）：
   `powershell -File tools\parity\Set-LabelShopField.ps1 -Value 'D:\...\out.pdf' -InvokeButton '保存'`

## 三、本轮新增的取证工具 `tools/parity/Set-LabelShopField.ps1`

给「另存打印输出为」这类**现代 Common Item Dialog** 注入文件名并按保存。**踩过并写进脚本头注释的四个坑**：

1. **`LabelShopCtl.ps1` 的 `keydlg`（SendKeys）对现代文件对话框无效** —— 实测 `^a` + 路径打进去后字段**保持为空**
   （`probe-r110-saveas-typed.png` 即证据，文件名框仍是空的）。
2. **该对话框不在 UIA `RootElement` 的 `Children` 里** —— 用 UIA 枚举顶层窗口时**根本看不到它**
   （只能看到 LabelShop 主窗口、Edge 等），所以 ValuePattern 那条路走不通。
3. **但它有真实子 HWND**：`listctl:` 能列出 `class=Edit`（在 `ComboBox` 里）、`class=Button text='保存(&S)'`。
   用 `WM_SETTEXT` 写文件名 + `BM_CLICK` 按保存**一次成功**（PDF 落盘，文件名即注入值）。
   注意 `WM_SETTEXT` 后回读仍是 `''`，**不能**用回读判定失败 —— 以落盘文件名为准。
4. 首版用 `-like` 匹配中文标题**匹配不上**（原因未深究，疑似跨进程 UIA/窗口标题编码），
   已加退化路径：「可见 `#32770` 且含一个文字以 `保存` 开头的 `Button`」。以后写这类工装别只靠中文标题匹配。

## 四、下一步（下轮按这个顺序查，别再从零搭）

1. **先确认"打印非空"**：在编辑器里放一个**明显的大对象**（如整张贴满的矩形），再打印到 PDF，
   确认 PDF 里能看到它。若仍是空白 → 问题在**打印链路本身**（如未选标签尺寸/纸张/输出方式），
   与"画不画孔"无关。
2. 重点看真机「打印」对话框（`probe-r110-print-dlg.png`，1354x758）里的**打印范围/纸张/输出方式**设置：
   文档是 100×70mm，而产出的 PDF 是 **A4**，说明**页面尺寸没跟着标签走**——这很可能就是空白页的成因
   （标签被画在 A4 页外的坐标上）。也检查右侧面板「设置」按钮里的打印机属性。
3. 便携替代路径（若 PDF 一直空）：真机「文件 → 导出打印机指令文件(E)」在编辑态是**禁用**的
   （见 `verifier-r43-file-menu.png`），需先确认它的启用条件；或者换 `Microsoft XPS Document Writer` 对比。
4. 拿到**非空**输出后，才算真正回答「孔在不在」；结论落 `parity/diffs.md` 的 P0 追加 6 条目。

## 五、顺带确认（与 round-44 一致，未变）

- 真机「标签格式设置」里 **孔洞=圆洞 + 尺寸 20** 时，**对话框预览画孔**、**编辑器画布画孔** —— 本轮再次复现。
- 该对话框的**预览行**、**分组框**、**字段名**、**三孔洞项**、**三形状项（含 `方角矩形`）** 与 round-106/107 的 dump 完全一致。

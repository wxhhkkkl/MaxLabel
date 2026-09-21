# round-119 真机取证：DIFF-70 打印输出仍不可判定

日期：2026-09-21。真机：签赋 LabelShop V6.39 标准版-未激活。

## 结论三态

- **原版有**：`孔洞=圆洞`、尺寸 `20` 时，标签格式设置对话框与编辑器画布都显示中心圆孔。
- **原版有但受限**：从编辑器右侧打印面板点击“打印”首先弹出“登录 LabelShop”；本轮没有输入账号或密码。点击“取消”后继续到“将打印输出另存为”，可以保存文件，但不能据此认为打印链路有效。
- **原版有无孔输出：待取证**：保存得到的 PDF 是空白 A4 页，既没有标签轮廓也没有内容，故无法判断孔是否存在。

## 可复现步骤

使用现有工装（未修改工装）：

1. `Invoke-LabelShopSteps.ps1 -StepsFile tools/parity/steps/verifier-hole-scene-1.txt` 进入“选择标签格式”。
2. 当前对话框执行 `btn:自定义` 打开“标签格式设置”。
3. `Probe-LabelShopCombos.ps1 -TitleLike '*标签格式设置*' -SetCombo 0 -SetIndex 1`，将孔洞设为“圆洞”。
4. `Invoke-LabelShopSteps.ps1 -StepsFile tools/parity/steps/verifier-hole-scene-7.txt`，写入尺寸 `20`。
5. 点击“确定”回到编辑器，截图后点击右侧面板“打印”。
6. 点击登录框“取消”，用 `Set-LabelShopField.ps1` 将输出保存为 `r119-hole-print.pdf`。

## 证据

- `round119-custom-label.png`：标签格式设置页面与 100×70、圆角矩形、孔洞=无的初始界面。
- `round119-editor-hole20.png`：孔洞=圆洞、20mm 后编辑器画布中心的圆孔。
- `round119-print-dialog.png`：点击打印后出现“登录 LabelShop”。
- `round119-preview-try.png`：取消登录后进入“将打印输出另存为”，不是打印预览窗口。
- `round119-hole-print.pdf`：保存产物，835 字节。

PDF 独立核验（PyMuPDF）：1 页，`MediaBox=595.32×841.92 pt`（A4），`drawings=0`、`images=0`、文本为空；渲染结果 `tools/loop/logs/r119-hole-page.png` 为纯白页。

## 处置

保持 DIFF-70 为“待取证”。本轮尝试了右侧面板打印、取消登录、保存 PDF 和已有文件菜单/打印预览路线；仍未取得非空打印输出。下一次应先用明显的大矩形确认该输出链路能产生非空页面，或在真机完成可用授权后再判断孔；不得把本轮空白 PDF 解释为“输出不画孔”。

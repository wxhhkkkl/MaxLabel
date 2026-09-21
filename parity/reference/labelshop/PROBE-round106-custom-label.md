# round-106 P0 追加项真机取证：自定义格式设置

日期：2026-09-21

## 复现路径

使用现成工装启动 LabelShop V6.39：

1. `LabelShopCtl.ps1 -Action run -KeepOpen -Steps @('keys:^{n}','btn:新建标签模板','btn:下一步')` 进入「选择标签格式」。
2. `Probe-LabelShopCombos.ps1 -TitleLike '*选择标签格式*' -ListOnly` 枚举「标签名称(L)」下拉。
3. `LabelShopCtl.ps1 -Action run -KeepOpen -Steps @('btn:自定义','sleep:1500','shotdlg:round106-custom-label-dialog')` 通过按钮消息点击「自定义(N)」。
4. `Read-LabelShopDialogTree.ps1 -TitleLike '*标签格式设置*' -MaxDepth 6`、`Read-LabelShopDialogValues.ps1 -TitleLike '*标签格式设置*' -IncludeDisabled` 读取当前页控件与初始值。
5. 点击「确定」，截图主窗口并列出文档视图控件。

## 证据

- 选择页：`round106-choose-label.png`、`probe-round106-choose-label-combos.txt`。
- 自定义对话框：`round106-custom-label-dialog.png`、`probe-round106-custom-label-tree.txt`、`probe-round106-custom-label-values.txt`、`probe-round106-custom-label-combos.txt`。
- 确定后的编辑器：`round106-after-custom.png`。

## 结论（三态）

### 1. 自定义入口：原版有

「标签名称(L)」下拉共 42 项，没有「自定义」。底部「自定义(&N)」按钮打开标题为「标签格式设置」的四页签对话框；点击「确定」直接返回新标签编辑器，主窗口标题变成「新标签模板1」，没有回到选择列表。

### 2. 标签页字段：原版有

初始值为宽度 `100.00`、高度 `70.00`、列距 `2.00`、行距 `2.00`、列数 `2`、行数 `4`，形状为「圆角矩形」，预览行原文为 `100.00 x 70.00 毫米 [4行 2列]`。

可见分组框为「标签」「间距」「行列」「形状」「孔洞」。孔洞下拉完整枚举为 `无`、`圆洞`、`矩形` 三项；初始「无」时尺寸 Edit 与「毫米」均为禁用。底部按钮为「确定」「取消」「应用(&A)」「帮助」，其中「应用(&A)」禁用。控件树还记录了不可见的「多行标签」按钮。

### 3. 打印机页额外控件：原版有

递归控件树记录了「名称(&N)」下拉、「标准驱动(&S)」「设置(&S)」「高级设置(&A)」「安装(&I)」按钮，以及「整页反相打印」「镜像输出」「单页任务模式」三个按钮。它们属于真机的「打印机」页，不是标签页字段。


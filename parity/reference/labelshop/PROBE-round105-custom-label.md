# round-105 P0 真机取证：选择标签格式的自定义入口与圆角

日期：2026-09-21

## 取证路径

使用现成工装启动真机 `C:\Program Files (x86)\LabelShop\LabelShop\LabelShop.exe`：

1. `LabelShopCtl.ps1 -Action run -KeepOpen -Steps @('keys:^{n}', 'btn:新建标签模板', 'btn:下一步')` 进入「选择标签格式」。
2. `Probe-LabelShopCombos.ps1 -TitleLike '*选择标签格式*' -ListOnly` 枚举「标签名称(L)」完整列表。
3. `LabelShopCtl.ps1 -Action run -KeepOpen -Steps @('btn:自定义', 'sleep:1500', 'shotdlg:round105-custom-label')`，即通过真机按钮消息路径点击「自定义(N)」。
4. `Read-LabelShopDialogTree.ps1 -TitleLike '*标签格式设置*' -MaxDepth 6` 和 `Read-LabelShopDialogValues.ps1 -TitleLike '*标签格式设置*' -IncludeDisabled` 读取控件树和值。
5. 点「确定」，截图 `round105-after-custom.png`，确认返回新标签编辑器；编辑器状态栏缩放为 261%。

## 证据文件

- `round105-choose-label.png`：选择标签格式界面。
- `probe-round105-choose-label-tree.txt`：选择标签格式控件树。
- `round105-custom-label.png`：点击「自定义(N)」后的标签格式设置界面。
- `probe-round105-custom-label-tree.txt`：四页签对话框递归控件树。
- `probe-round105-custom-label-values.txt`：当前页 Edit/Combo 值。
- `round105-after-custom.png`：点「确定」后返回新标签编辑器，标签为圆角矩形。

## 结论三态

### 「自定义(N)」入口：原版有

「选择标签格式」底部按钮顺序为「选择(O) / 自定义(N) / 取消(C) / 帮助(H)」。
「自定义(N)」不是「标签名称(L)」下拉的一项；名称下拉当前平张目录共 42 项，完整枚举见 `probe-round105-choose-label-tree.txt`，其中没有「自定义」。

点击「自定义(N)」后打开标题为「标签格式设置」的四页签对话框，而不是在名称下拉下方内联展开宽高输入框。

### 自定义对话框：原版有

页签从左到右为「打印机 / 页面 / 标签 / 其它」，初始显示「标签」页。当前格式 `[608053] 100mm x 70mm 圆角8枚/页 20页/盒` 点入后的「标签」页可见：

- 标签：宽度 100.00、高度 70.00、形状「圆角矩形」；
- 间距：列距 2.00、行距 2.00；
- 孔洞：下拉「无」，右侧毫米输入框禁用；
- 行列：列数 2、行数 4；
- 没有「圆角半径」输入框。

点击「确定」后不返回「选择标签格式」列表，而是直接创建并回到新标签编辑器。

### 圆角规则：原版有但受限

`round105-after-custom.png` 中编辑器缩放 261%，标签外框两条稳定竖线间距 1479px，对应 100mm，即 0.0676mm/px。左上角 ASCII 角区（由 `measure-corner-radius.cjs` 输出）显示弧线跨约 13–15px，换算约 0.9–1.0mm。该值与 round-104 预览量测的约 0.9–1.1mm 一致，说明真机使用约 1mm 的固定圆角，而不是短边的 12%。

复刻实现因此采用固定 1mm 默认圆角；直角矩形仍为 0，圆形按宽/高作为两个方向直径，圆形带孔时再扣除孔洞直径。模型仍保留显式 `cornerRadiusMm` 以兼容已有模板和渲染回归中显式指定的半径，但 UI 不再提供该输入框。

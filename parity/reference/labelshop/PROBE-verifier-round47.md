# 验收方 round-47 真机取证：「登录 LabelShop」对话框 + 未登录时的打印门槛

日期：2026-09-21（循环 round 109 期间）。真机：签赋 LabelShop V6.39 标准版-未激活（未登录）。

## 一、新证据：真机「登录 LabelShop」对话框实拍（`verifier-r47-print-dialog.png`）

之前 `parity/reference/labelshop/INDEX.md` 只记了「登录 LabelShop（模态登录框，无编号）」这一条、**没有图**，现在补上了：

```
标题：登录 LabelShop
说明：请使用云马科技账号登录服务器，激活 签赋 LabelShop
  服务器： [360Code.com            ▾]
  输入帐号：[                    ]
  请输入密码：[                  ]   ☐ 显示密码
  ☑ 保存账号和密码                    ☑ 自动登录
  [ 登录 ]  [ 忘记密码 ]  [ 注册新用户 ]

  当您登录后，您的文档和设置都会处于联机状态
  ☐ 不再提示
  [ 了解更多信息 ]                    [ 取消 ]（默认按钮，高亮）
```

## 二、发现：**未登录时打印被登录门槛挡住**

- 在编辑态按 `Ctrl+P`：弹出的**不是打印对话框，而是上面这个登录框**（`shotdlg` 抓到 729x791 的登录窗口）。
- 关掉登录框后，走 `文件(F)` 菜单用 `{DOWN 7}{ENTER}`：同样**又弹回登录框**（`listctl` 根窗口＝`登录 LabelShop`，17 个控件）。
  → 说明 `打印(P)...` / `打印预览(V)` 在此机器上（未登录）都会引导到登录。

## 三、对 P0 追加 6 的影响（最后一条仍未验）

- 已证：**对话框预览画孔**、**编辑器画布画孔**（见 `PROBE-verifier-round44.md`）。
- 未证：**打印输出里有没有孔**——现在卡在"未登录不能打印"这条门槛上，本机取证**到此为止**。
- 处置建议（写进 `round-focus.md`）：按 E 区"授权/登录边界"的口径**登记为受限项**并写清理由；
  若日后拿到可用账号/激活，再补"打印到 Microsoft Print to PDF → PDF 渲染成位图 → 看中心有没有孔"。

## 四、本轮产物

| 文件 | 内容 |
| --- | --- |
| `verifier-r47-print-dialog.png` | **真机「登录 LabelShop」对话框**（首张实拍） |
| `verifier-r47-hole20-dialog.png` | 标签格式设置（100×70 圆角 + 圆洞 20，注入后截图） |
| `verifier-r47-file-menu2.png` | 编辑态文件菜单（复拍，用于数项序号） |
| `verifier-r47-preview-try.png` | 打印预览尝试（实际弹回登录框） |
| `tools/parity/steps/verifier-hole-scene-{9,10}.txt` | 本轮步骤 |

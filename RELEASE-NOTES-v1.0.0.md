# MaxLabel v1.0.0 发布说明

**发布对象**：签赋 LabelShop V6.39（中文版）的功能与操作习惯复刻版
**发布类型**：Windows x64 内部测试安装包（**未做代码签名**）
**日期**：2026-09-17

---

## 一、交付产物

| 产物 | 路径 | 大小 | 说明 |
| --- | --- | --- | --- |
| 安装包 | `app/release/MaxLabel-Setup-1.0.0.exe` | 129.25 MB | NSIS 安装向导（非一键、可选安装目录、创建桌面与开始菜单快捷方式） |
| 分块映射 | `app/release/MaxLabel-Setup-1.0.0.exe.blockmap` | 0.14 MB | 供增量更新使用 |
| 免安装目录 | `app/release/win-unpacked/` | — | 直接运行 `MaxLabel.exe`（234.7 MB 主程序） |
| 校验和 | `RELEASE-SHA256.txt` | — | `334E6C724D2CD268557F1E95F7B6A12DB0FFE287E63BB54445F34E0757EED77E` |

**打包命令**：`cd app && npm run dist`（内部未签名路径：`scripts/build-windows.cjs` 自动加 `--config.win.signAndEditExecutable=false`；配好证书后（`CSC_LINK`/`WIN_CSC_LINK`）会自动签名）

**冒烟验证**：启动 `release/win-unpacked/MaxLabel.exe` 正常拉起（Electron 主进程 + 渲染进程，约 100 MB/进程），干净退出 ✅

---

## 二、验收状态（发布依据）

| 验收项 | 结果 |
| --- | --- |
| parity 矩阵 | **605 / 605 全部「已实现」**（部分 0 / 未实现 0 / 待核 0，覆盖 **100%**） |
| 未收口差异 | **0 条**（累计 27 条 DIFF 全部收口或按已记录边界/等价替代写明） |
| 静态与单元门禁 | `typecheck` / `test:architecture` / `test:editor` / `test:geometry` / `test:history` / `test:print`(104 断言组) / `test:render`(46) / `test:workspace` / `build` → **9/9 通过** |
| UI 回归 | **`test:ui` 66 个脚本全部 PASS**（`app/scripts/ui-v48…v115`） |
| 安装器 | `npm run test:installer` 通过（许可协议页、卸载链路 E-13/E-14/E-15） |
| 标签库可复现 | 生成器读入库原件 `sources/LabelFormat360.fmt`，重跑产出**字节一致**的 275 条 |

对齐证据：原版真机取证图 28 张、复刻截图 130+ 张、并排对照 33 张，均在 `parity/reference/` 与 `parity/review/`。

---

## 三、安装与使用

1. 运行 `MaxLabel-Setup-1.0.0.exe`，按向导完成安装（可自选安装目录）；
2. 首次启动弹出许可对话框：填入密钥（或使用内置演示/本地模式），在线校验 + 机器绑定后缓存本地授权；
3. 主界面与真机一致：起始页 → 「新建标签模版」（Ctrl+N）→ 模板向导 → 选择标签格式 → 编辑；
4. 打印：底部打印面板选打印机（Windows 驱动或指令直连 TSPL/ZPL/CPCL），可「打印预览」后再「打印」；`Ctrl+P` 打开完整打印对话框（含高级选项两页）。

---

## 四、功能覆盖（四大块）

- **界面与操作习惯**：起始页、12 项顶层菜单与加速键、三行工具栏（工具栏/格式栏/对齐栏，含「添加或删除按钮」自定义）、状态栏 6 段、左右面板、右键上下文菜单、系统选项各页、四个界面主题。
- **编辑器对象能力**：文字/条码/RFID/线条/图形/图片/表格 7 类对象；条码 18 种码制与各码制特殊选项；对象属性页（通用/文字/字体/数据/图片/RFID/方框和圆形/直线和斜线）；对齐、尺寸、间距、旋转、层次、组合、位置锁定；可变颜色（7 种模式 + 10 预定义索引色）。
- **数据源与数据库**：主数据源 7 类（常量/序列号/日期/时间/数据库/键盘输入/脚本）、附加子串、字符数限制与截短、非打印字符、小数位与比例、文本/Excel/ODBC/云数据库导入（含 BOM/GB18030 编码识别）、多数据库连接、记录导航、打印查重。
- **打印链路**：打印对话框（16 项字段/按钮，`打印标签边框` 按原版禁用）、打印机属性三页签（首选项/端口/自定义命令）与设备发现、安装打印机与指令集兼容矩阵、高级选项（页眉页脚/定位裁切标记/数据库）、打印预览窗口、打印日志与测试打印语义、条码图片导出、自动旋转输出页面。

---

## 五、已记录边界（有意不复刻，均已在矩阵写明理由）

| 条目 | 原版行为 | 处理 |
| --- | --- | --- |
| 硬件锁（加密狗）激活 | 用实体狗激活专业版/企业版 | 单版本产品无版本维度；等价物为**密钥激活**（在线校验 + 机器绑定 + 本地缓存） |
| 专业版演示模式 | 打印时随机输出提示信息 | 不做假实现（会破坏打印正确性）；原入口保留，改为打开版本说明 |
| 三版本分层（标准/专业/企业）相关字段 | 如条码「缩减量」仅企业版可用 | 单版本产品不提供该字段，矩阵已注明 |
| 起始页右区运营图文 | 服务端下发广告位/文章/下载 | 保留**同构分区与布局**，内容由本地占位 |
| 内置驱动不支持打印预览 | 原版内置驱动端口无预览 | 复刻版无该端口类型，限制不适用 |
| 真机指令方言 | TSPL/ZPL/CPCL 各机型方言 | 结构与协议按帮助实现，真机方言需硬件实测 |

---

## 六、如何发布到 GitHub Releases

本机未安装 `gh` CLI。两种方式：

**方式 A（网页）**：打开 https://github.com/wxhhkkkl/MaxLabel/releases/new → 选择 tag `v1.0.0` → 标题填 `MaxLabel v1.0.0` → 正文粘贴本文件 → 上传 `app/release/MaxLabel-Setup-1.0.0.exe` 与 `.blockmap` → 发布。

**方式 B（CLI）**：安装 `gh` 并登录后

```powershell
cd D:\workspace\maxlabel
git tag -a v1.0.0 -m "MaxLabel v1.0.0：LabelShop 复刻 parity 605/605、门禁全绿"
git push origin v1.0.0
gh release create v1.0.0 app/release/MaxLabel-Setup-1.0.0.exe app/release/MaxLabel-Setup-1.0.0.exe.blockmap --title "MaxLabel v1.0.0" --notes-file RELEASE-NOTES-v1.0.0.md
```

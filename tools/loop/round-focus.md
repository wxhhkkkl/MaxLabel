# 本轮起（循环 round-104 起）指定任务与硬性口径

> 本文件由验收方维护（2026-09-21 重写；上一版写于 09-17、基线 33%，已全部过期——**不要再按旧内容选活**）。

## 一、当前真实基线（验收方实测，2026-09-21）

| 项 | 值 |
| --- | --- |
| 矩阵 `parity/matrix.md` | 605 条 → **已实现 605 / 部分 0 / 未实现 0 / 待核 0（100%）**；`Check-Matrix.ps1` exit 0 |
| 需求清单 `parity/需求清单-待验证队列.md` | **194/194 全部有结论（待填 0 条）** |
| 全量 UI 回归 | **79 个脚本**（`ui-v48 … ui-v128`）全绿（`tools/loop/logs/round-60g-ui.log`） |
| 单元门禁 | `npm test` 全绿（typecheck / architecture / color / barcode / editor 40 / geometry / history / printer / print / render 54 / workspace）；另 label-spec / label-formats / update / title / license / close / installer / evidence 全 exit 0 |
| 已发布 | **v1.0.17**（`app/release/MaxLabel-Setup-1.0.17.exe`，SHA256 `76A01BCE…6A1E`，冒烟 4/4）；`main` 与 tag `v1.0.0…v1.0.17` 已推送 |
| 未收口差异 | `parity/diffs.md`：**DIFF-63**（待真机点按）、**DIFF-50 / DIFF-60**（观察项） |

**`parity/backlog.md` 是历史档案（900+ 行，最新在最上），里面很多"待办"早已做完**——只按本文件选活；backlog 只在收尾时追加本轮记录。

## 二、做活的硬性口径（用户要求，违反即返工）

1. **结论三态写清**：原版**有** / 原版**无** / 原版**有但受限**，并给可复现证据（真机截图或控件 dump 文件名 + 帮助页名 + 复刻版断言名/命令）。
2. **不许按猜测造功能**。语义不确定 → 先取证（真机 > 帮助）；取不到就在 `parity/diffs.md` 登记为「待取证」并写清**已试过的手法与失败现象**，不许实现猜测版本、不许留 TODO/假实现。
3. **不许为过测试而改弱断言**；测试随行为变更失效时，改测试可以，但断言强度不能降，并在提交信息里说明理由。
4. 每收口 1-2 条就 `git add -A && git commit`（含 matrix/diffs/清单更新），提交信息写清条目编号（DIFF-xx / 清单第 N 条 / 矩阵条目号）。

## 三、优先级清单（按顺序取第一项尚未完成的）

### 优先级 1 · DIFF-63：真机序列号数据源面板的「重置初始值: / 立即重置」

- 已有证据：`parity/reference/labelshop/PROBE-round60.md`。`LabelShop.exe` 字符串资源（UTF-16LE）里确认了这两处字样，同面板的标题集也已拿全；但页面切源不重排（`tools/parity/Probe-LabelShopSerialPage.ps1` 已试过 `CB_SETCURSEL` + `CBN_SELCHANGE/CBN_SELENDOK` + 回车，序列号子面板连隐藏控件都不存在），复刻版**未实现**、也**没有按猜测实现**。
- 要求：① 用**真实鼠标路径**把真机数据源下拉切到「序列号」再 dump 数据源页：可用 `tools/parity/LabelShopCtl.ps1` 的 `postclick:` / `postdrag:` 步骤（本机 `SetCursorPos`+`mouse_event` 无效，务必用 PostMessage 手法），必要时先 `keys:` 聚焦下拉再用 `{DOWN}{ENTER}`；② 点一次「立即重置」，看它对「显示数据」的即时影响；③ 把子面板的完整控件/默认值写进 `parity/reference/labelshop/PROBE-round6x.md`；④ 结论落 `parity/diffs.md` DIFF-63 与 `parity/需求清单-待验证队列.md` 第 201 条；⑤ 语义确认后按真机实现并补 `app/scripts/ui-v1NN.cjs` 断言（含 `run-regression.ps1` 注册）；仍取不到就写清失败现象，保持「待取证」。
- 参考：真机序列号面板的资源标题集＝ 序列号 / 类型(&T): / 序列(&Q): / 步长(&S): / 增量(&A) / 减量(&D) / 重复(&E): / 序列号设置 / 重置 / 提示(&P): / 归位 / 初始值来源(&R): / 数据库连接(&D): / 重置初始值: / 立即重置。

### 优先级 2 · 对象编辑三处真机待确认（round-114 遗留）

见 `parity/reference/labelshop/PROBE-round114.md`：① CTRL+拖动是**复制**还是移动；② 原版拖动有没有**对齐参考线**吸附；③ 点空心矩形**内部**算不算选中。取证手法同优先级 1；结论进 `parity/diffs.md` + 需求清单，行为不一致就对齐实现并补断言。

### 优先级 3 · 两条观察项 + E 区 5 条边界（只取证、写结论，不造功能）

- DIFF-50：真机对象属性「水平/垂直」相对标签边对齐下拉**是灰的**的成因（按对象类型决定可用性只收口了一半）。
- DIFF-60：真机 EAN/UPC 条码页没有「附加条码」「校验字符」、25 码族无独立校验字符，复刻版按原版帮助保留——把「真机实测 vs 帮助原文」的冲突写透，给出保留/删除的理由与证据。
- E 区 5 条：硬件锁激活（E-09）、专业版演示模式（E-10）、三版本分层字段、起始页服务端运营图文（A-271）、内置驱动不支持预览——按 `app/docs/labelshop-compatibility-audit.md` 的单版本策略写「已记录边界 + 理由」，不实现。

### 优先级 4 · 继续找新差异（提升相似度的主线路）

用 `tools/parity/LabelShopCtl.ps1` 对真机**逐页截图**（菜单、各对话框、属性页、打印流程、标签格式），与复刻版同页用 `tools/parity/Compare-SideBySide.ps1` 并排比对，把新差异登记 `parity/diffs.md`（**DIFF-64 起**）并逐条修。每条差异都要有：真机图 + 复刻图 + 断言名/命令。重点还没逐像素对过的面：工具栏/对齐栏逐按钮形态、右键上下文菜单、数据库菜单连库前后、打印对话框高级页、系统选项各页。

### 优先级 5 · 打印机链路（部分待用户配合）

佳博 GP-1324D 未装官方驱动（无打印队列），USB 直发待用户装驱动后验证；真机残留的 `TSC TSPL-N (203 dpi)` 需用户鼠标移除。你能先做的：对着 `print_printer_cfg_*` 帮助页把「有队列 / 无队列」两条发送路径的分支与错误提示再核一遍，补单测；把「删除已添加打印机」的完整链路（含残留项）与真机行为再对照一次（用户实测过这两处）。

## 四、每轮收尾（硬性）

```powershell
cd app
npm run build            # test:ui 跑 out/ 构建产物：改了 renderer 必须先 build
npm run typecheck
npm test                 # 含 editor / geometry / history / printer / print / render / workspace 等
npm run test:ui          # 79 个脚本，约 50 分钟；同一时刻只允许一套（独占锁，并发造假失败）
cd ..
powershell -File tools\parity\Check-Matrix.ps1
powershell -File tools\parity\Report-Progress.ps1
```

**本机血泪坑**：

- 改 `.ps1`（含用编辑器工具改）会**掉 UTF-8 BOM** → PS 5.1 按 GBK 解析中文报 `Unexpected token '}'`；改完确认首字节是 `EF BB BF`。
- 改 `app/package.json` 等无 BOM 的 UTF-8 文件：必须 `[IO.File]::ReadAllText($p,[Text.UTF8Encoding]::new($false))` 读、同编码写，改完 `node -e "require('./package.json')"` 验证。
- 打包前先 `Get-Process MaxLabel,electron | Stop-Process -Force`；打包脚本的「未检测到代码签名证书」走 stderr 会让退出码变 1，**产物是好的**。
- `parity/evidence` 校验器会把 matrix 证据列里含 `/` 或 `\` 的反引号片段当路径——写证据时避免反引号里放路径。

## 五、出包与推送（有用户可见改动时做）

bump `app/package.json` 版本 → `npm run build` → `node scripts/build-windows.cjs` → 计算 SHA256 写 `RELEASE-SHA256.txt` → 写 `RELEASE-NOTES-vX.Y.Z.md` 与 `tools/loop/logs/vX.Y.Z-gates.md` → `git commit` + `git tag -a vX.Y.Z` + `git push origin main` 与 tag（网络不稳时重试 2-6 次）。

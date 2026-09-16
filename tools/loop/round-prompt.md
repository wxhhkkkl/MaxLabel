# 本轮任务（LabelShop 复刻 parity 循环）

你是本仓库的实施者。目标：把 `app/`（MaxLabel）复刻成与**真机 LabelShop V6.39（MFC 中文版）**在用户可见行为上高度一致的软件。
真机已装在本机：`C:\Program Files (x86)\LabelShop\LabelShop\LabelShop.exe`，可自由启动取证。

## 每轮必须遵守的流程

1. **先读这四份文件**（缺哪份就先用现有信息创建它）：
   - `parity/matrix.md` —— 功能清单与状态（`待核` / `部分` / `未实现` / `已实现`）
   - `parity/backlog.md` —— 优先级队列
   - `tools/loop/last-gates.md` —— 上一轮门禁结果
   - `parity/FAILURES.md` —— 若存在且非空，**本轮唯一任务是修好它**，修完再谈新功能
2. 从 `parity/backlog.md` 选 **3-6 条同一模块**的条目（优先 P0、优先 `未实现`），逐条做完整。
3. **实现要求**
   - 用户可见行为必须对标：入口位置、菜单/按钮文案、快捷键、默认值、取值范围、单位、校验规则、错误提示、数据推进顺序、对话框流程。
   - 依据来源优先级：`parity/reference/labelshop/*.png`（真机截图） > `app/docs/labelshop-help-zh/*.html`（中文帮助） > 现有代码注释。
   - 需要新的真机证据时，用现成工装取证（不要自己写新的真机驱动）：
     ```powershell
     powershell -File tools/parity/LabelShopCtl.ps1 -Action run -Steps 'click:42,36','sleep:1500','shotscreen:10-menu-file','keys:{ESC}'
     ```
     截图写入 `parity/reference/labelshop/`，命名要能看出是什么界面（如 `10-menu-file.png`）。
   - 不要为了通过测试而删改/跳过测试；不要留 TODO 占位或假实现；不要把功能藏在不用的开关后面。
   - 架构边界遵守 `app/docs/architecture.md` 和 `app/docs/labelshop-compatibility-audit.md`：编辑画布 / 位图输出 / TSPL/ZPL/CPCL 必须共用 `ResolvedPrintScene`，不允许各自解释模板。
4. **自测（必须全过，不过就修到过）**，在 `app/` 下依次执行：
   ```
   npm run typecheck
   npm run test:architecture
   npm run test:editor
   npm run test:geometry
   npm run test:history
   npm run test:print
   npm run test:render
   npm run test:workspace
   npm run build
   ```
   改了 UI 还要跑 `npm run test:ui`。
   本轮新增/修改的每一条用户可见行为，都必须有对应回归测试或 CDP 冒烟脚本覆盖（放 `app/scripts/` 下，命名 `ui-vNN.cjs` 或加入既有测试），并在汇报里给出命令。
5. **更新 `parity/matrix.md`**：本轮做完的条目，状态改为 `已实现`，并在「证据」列写清证据（测试名 / 截图文件名 / 命令）。
6. **更新 `parity/backlog.md`**：勾掉已完成项，补上本轮新发现的缺口（写明来源文件或截图）。
7. **边做边提交（硬性要求）**：本轮有硬性超时（约 45 分钟），**超时会被强制终止**，你会来不及汇报。因此：每完成 **1-2 条** 就立刻 `git add -A && git commit -m "parity: <模块> <做了什么>"`，并同步把这几条在 `parity/matrix.md` 里改成 `已实现` + 写证据、在 `parity/backlog.md` 里勾掉。**不要攒到最后一起提交**。
   提交前跑一次清单校验，必须通过（exit 0）：
   ```
   powershell -File tools/parity/Check-Matrix.ps1
   ```
   它会检查编号/状态合法性，以及「状态为 已实现 或 部分 时必须填证据」——校验不过说明你的证据没写。
8. **如果 `parity/progress.md` 显示上一轮是超时结束（exit=124）**：本轮第一件事是用 `git show --stat HEAD` 核对上一轮实际改了什么，把其中确实做完的条目标为 `已实现` 并补证据，提交之后再做新条目。
9. **最后用中文汇报**（这段会被日志收走并展示给人看）：
   - 完成的条目编号与一句话说明
   - 改动的主要文件
   - 跑了哪些命令、结果如何
   - 剩余风险与下一步建议

## 禁止事项

- 不要修改 `parity/reference/` 下的真机证据文件；不要改 `tools/parity/LabelShopCtl.ps1`（真机取证工装由循环控制者维护）。若工装本身有问题，写进 `parity/backlog.md`。
- 不要 `git push --force`、不要重写历史、不要删除既有测试、不要动 `server/`（除非 backlog 明确要求）。
- 不要在同一轮里同时大改多个模块；一次只推进一个模块，做完做透。

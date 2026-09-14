# 结算轮（只落账，不写代码）

上一轮是**超时结束**，你来不及把成果登记到清单。本轮**不要写任何产品代码**，只做登记：

1. `git log --oneline -3`、`git show --stat HEAD`、`git status --short` 看清上一轮实际改了什么（`HEAD` 可能是循环控制者的自动提交）。
2. 打开 `parity/matrix.md`，把上一轮**确实已完成且门禁通过**的条目状态从 `待核` 改成 `已实现`，「证据」列写清：
   - 测试脚本名 + 关键断言（例如 `ui-v53.cjs 12/12`）
   - 证据截图路径（例如 `parity/reference/maxlabel/02-editor.png`）
   - 关键代码位置（例如 `app/src/renderer/src/editor/StatusBar.tsx`）
   只写有把握的；有部分完成的写 `部分`；没做的保持 `待核`。
3. `parity/backlog.md` 勾掉已完成项；`parity/diffs.md` 勾掉已收口的差异行（把状态列改成 `✅ 已修（round-XX，证据）`）。
4. 校验并提交：
   ```
   powershell -File tools/parity/Check-Matrix.ps1
   git add -A
   git commit -m "parity: 结算上一轮清单与证据"
   ```
   `Check-Matrix.ps1` 必须 exit 0（状态为 `已实现`/`部分` 的条目必须有证据）。
5. 中文汇报：改了哪些条目编号、各自的证据、剩余未登记或不确定的部分。

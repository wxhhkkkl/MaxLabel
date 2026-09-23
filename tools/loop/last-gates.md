# 门禁结果（round-133）

- 时间：2026-09-23 09:54:01
- HEAD：c0b98c6fc05511e53e7f4ce689bf8379fb1a2c14
- 门禁策略：跑全量 test:ui（本轮改了 UI 相关文件：app/scripts/ui-v105.cjs, app/scripts/ui-v138.cjs, app/scripts/ui-v52.cjs, app/src/renderer/src/features/commands/labelShopMenus.ts）
- 结论：失败 9 项: typecheck, test:editor, test:geometry, test:history, test:print, test:render, test:workspace, build, test:ui

[FAIL] typecheck (exit=1, 1s)
> maxlabel@1.0.20 typecheck
> npm run typecheck:node && npm run typecheck:web
> maxlabel@1.0.20 typecheck:node
> tsc --noEmit -p tsconfig.node.json
'tsc' 不是内部或外部命令，也不是可运行的程序
或批处理文件。

[PASS] test:architecture (exit=0, 1s)
> maxlabel@1.0.20 test:architecture
> node scripts/architecture-check.cjs && node scripts/runner-safety.test.cjs
7 architecture checks passed
18 runner safety checks passed

[FAIL] test:editor (exit=1, 0s)
> maxlabel@1.0.20 test:editor
> esbuild scripts/editor-operations.test.ts --bundle --platform=node --format=cjs --outfile=scripts/_editor.cjs && node scripts/_editor.cjs && node -e "require('fs').unlinkSync('scripts/_editor.cjs')"
'esbuild' 不是内部或外部命令，也不是可运行的程序
或批处理文件。

[FAIL] test:geometry (exit=1, 0s)
> maxlabel@1.0.20 test:geometry
> esbuild scripts/editor-geometry.test.ts --bundle --platform=node --format=cjs --outfile=scripts/_geometry-test.cjs && node scripts/_geometry-test.cjs && node -e "require('fs').unlinkSync('scripts/_geometry-test.cjs')"
'esbuild' 不是内部或外部命令，也不是可运行的程序
或批处理文件。

[FAIL] test:history (exit=1, 0s)
> maxlabel@1.0.20 test:history
> esbuild scripts/document-history.test.ts --bundle --platform=node --format=cjs --outfile=scripts/_history.cjs && node scripts/_history.cjs && node -e "require('fs').unlinkSync('scripts/_history.cjs')"
'esbuild' 不是内部或外部命令，也不是可运行的程序
或批处理文件。

[FAIL] test:print (exit=1, 0s)
> maxlabel@1.0.20 test:print
> esbuild scripts/print-engine.test.ts --bundle --platform=node --format=cjs --outfile=scripts/_t.cjs --external:electron && node scripts/_t.cjs && node -e "require('fs').unlinkSync('scripts/_t.cjs')"
'esbuild' 不是内部或外部命令，也不是可运行的程序
或批处理文件。

[FAIL] test:render (exit=1, 0s)
> maxlabel@1.0.20 test:render
> electron scripts/render-regression.cjs
'electron' 不是内部或外部命令，也不是可运行的程序
或批处理文件。

[FAIL] test:workspace (exit=1, 0s)
> maxlabel@1.0.20 test:workspace
> electron scripts/workspace-regression.cjs
'electron' 不是内部或外部命令，也不是可运行的程序
或批处理文件。

[FAIL] build (exit=1, 0s)
> maxlabel@1.0.20 build
> electron-vite build
'electron-vite' 不是内部或外部命令，也不是可运行的程序
或批处理文件。

[FAIL] test:ui (exit=1, 134s)
ui-v115.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v116.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v117.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v118.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v119.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v120.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v121.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v122.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v123.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v124.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v125.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v126.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v127.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v128.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v129.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v130.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v131.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v132.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v133.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v134.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v135.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v136.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v137.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
ui-v138.cjs : ? : 由于出现以下错误，无法运行此命令: 系统找不到指定的文件。。
FAILED SCRIPTS: ui-v49.cjs, ui-v50.cjs, ui-v52.cjs, ui-v53.cjs, ui-v54.cjs, ui-v55.cjs, ui-v56.cjs, ui-v57.cjs, ui-v58.cjs, ui-v59.cjs, ui-v60.cjs, ui-v61.cjs, ui-v62.cjs, ui-v63.cjs, ui-v64.cjs, ui-v65.cjs, ui-v66.cjs, ui-v67.cjs, ui-v68.cjs, ui-v69.cjs, ui-v70.cjs, ui-v71.cjs, ui-v72.cjs, ui-v73.cjs, ui-v74.cjs, ui-v75.cjs, ui-v76.cjs, ui-v77.cjs, ui-v78.cjs, ui-v79.cjs, ui-v80.cjs, ui-v81.cjs, ui-v82.cjs, ui-v83.cjs, ui-v84.cjs, ui-v85.cjs, ui-v86.cjs, ui-v87.cjs, ui-v88.cjs, ui-v89.cjs, ui-v90.cjs, ui-v91.cjs, ui-v92.cjs, ui-v93.cjs, ui-v94.cjs, ui-v95.cjs, ui-v96.cjs, ui-v97.cjs, ui-v98.cjs, ui-v99.cjs, ui-v100.cjs, ui-v101.cjs, ui-v102.cjs, ui-v103.cjs, ui-v104.cjs, ui-v105.cjs, ui-v106.cjs, ui-v107.cjs, ui-v108.cjs, ui-v109.cjs, ui-v110.cjs, ui-v111.cjs, ui-v112.cjs, ui-v113.cjs, ui-v114.cjs, ui-v115.cjs, ui-v116.cjs, ui-v117.cjs, ui-v118.cjs, ui-v119.cjs, ui-v120.cjs, ui-v121.cjs, ui-v122.cjs, ui-v123.cjs, ui-v124.cjs, ui-v125.cjs, ui-v126.cjs, ui-v127.cjs, ui-v128.cjs, ui-v129.cjs, ui-v130.cjs, ui-v131.cjs, ui-v132.cjs, ui-v133.cjs, ui-v134.cjs, ui-v135.cjs, ui-v136.cjs, ui-v137.cjs, ui-v138.cjs

[PASS] parity:matrix (exit=0, 1s)
=== parity/matrix.md 校验 ===
总条目：609
按章节 / 状态：
  A 界面与操作习惯          共 276 条：已实现=276
  B 编辑器对象能力          共 141 条：已实现=141
  C 数据源与数据库          共 101 条：已实现=101
  D 打印链路             共  75 条：已实现=75
  E 其他               共  16 条：已实现=16
合计：已实现 609 / 部分 0 / 未实现 0 / 待核 0（覆盖率 100%）
校验通过：编号、状态、证据、出处文件均合规。


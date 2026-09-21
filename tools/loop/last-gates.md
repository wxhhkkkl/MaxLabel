# 门禁结果（round-111）

- 时间：2026-09-21 15:27:21
- HEAD：3190e12fe724c52a20eddab34457bf18530bd1a4
- 门禁策略：跑全量 test:ui（本轮改了 UI 相关文件：app/scripts/ui-v106.cjs, app/scripts/ui-v109.cjs, app/scripts/ui-v117.cjs, app/scripts/ui-v124.cjs, app/scripts/ui-v125.cjs, app/scripts/ui-v126.cjs）
- 结论：全部通过

[PASS] typecheck (exit=0, 4s)
> maxlabel@1.0.18 typecheck
> npm run typecheck:node && npm run typecheck:web
> maxlabel@1.0.18 typecheck:node
> tsc --noEmit -p tsconfig.node.json
> maxlabel@1.0.18 typecheck:web
> tsc --noEmit -p tsconfig.web.json

[PASS] test:architecture (exit=0, 1s)
> maxlabel@1.0.18 test:architecture
> node scripts/architecture-check.cjs && node scripts/runner-safety.test.cjs
7 architecture checks passed
18 runner safety checks passed

[PASS] test:editor (exit=0, 1s)
> maxlabel@1.0.18 test:editor
> esbuild scripts/editor-operations.test.ts --bundle --platform=node --format=cjs --outfile=scripts/_editor.cjs && node scripts/_editor.cjs && node -e "require('fs').unlinkSync('scripts/_editor.cjs')"
  scripts\_editor.cjs  29.5kb
Done in 57ms
40 editor operation checks passed

[PASS] test:geometry (exit=0, 1s)
> maxlabel@1.0.18 test:geometry
> esbuild scripts/editor-geometry.test.ts --bundle --platform=node --format=cjs --outfile=scripts/_geometry-test.cjs && node scripts/_geometry-test.cjs && node -e "require('fs').unlinkSync('scripts/_geometry-test.cjs')"
  scripts\_geometry-test.cjs  2.0mb
Done in 108ms
1 editor geometry check passed

[PASS] test:history (exit=0, 1s)
> maxlabel@1.0.18 test:history
> esbuild scripts/document-history.test.ts --bundle --platform=node --format=cjs --outfile=scripts/_history.cjs && node scripts/_history.cjs && node -e "require('fs').unlinkSync('scripts/_history.cjs')"
  scripts\_history.cjs  3.8kb
Done in 4ms
9 document history checks passed

[PASS] test:print (exit=0, 2s)
  ✓ 序列号初始值可从键盘输入或数据库字段读取
  ✓ database source uses the selected field and per-label record offset
  ✓ 日期/时间格式化
  ✓ 同一打印上下文固定日期时间快照
  ✓ 日期格式支持中文组合与日期偏移
  ✓ 时间区域与偏移字段可解析
  ✓ VBScript OnGetData supports concatenation, arithmetic and globals
  ✓ 脚本语言选项驱动无函数声明的脚本执行
  ✓ 脚本语法检查按语言报告语法错误
  ✓ 脚本出错时整型变量置空字符串
  ✓ 脚本范围：预定义脚本库只读且可调用
  ✓ 非打印 ASCII 字符表含 1–31 共 31 项且码位递增
  ✓ template lifecycle updates output count and shared variables
  ✓ substring cut/trim/keep and max length
  ✓ min length padding
  ✓ ASCII 控制字符 1-31 全表解码
  ✓ ASCII 控制字符支持双左尖括号转义
  ✓ 分隔文本默认逗号并支持制表符/引号
  ✓ 分隔文本按 BOM 识别 UTF-8/UTF-16，无 BOM 回退 GB18030
  ✓ 测试打印不写日志且不推进序列号
  ✓ 打印日志 CSV 表头覆盖 LabelShop 保存项目
  ✓ 旋转180度输出只改变打印副本方向
  ✓ 自动旋转输出页面按纸张方向改变共享场景
  ✓ 自动旋转预览与指令输出共用旋转后的 ResolvedPrintScene
共通过 110 项断言组。

[PASS] test:render (exit=0, 1s)
PASS rect blank paper has no printed outline or hole outline
PASS rect centre hole clips content but preserves printable paper
PASS roundRect paper settings survive save/open normalization
PASS roundRect blank paper has no printed outline or hole outline
PASS roundRect centre hole clips content but preserves printable paper
PASS roundRect outer paper shape clips corner content
PASS ellipse paper settings survive save/open normalization
PASS ellipse blank paper has no printed outline or hole outline
PASS ellipse centre hole clips content but preserves printable paper
PASS ellipse outer paper shape clips corner content
PASS disc paper settings survive save/open normalization
PASS disc blank paper has no printed outline or hole outline
PASS disc centre hole clips content but preserves printable paper
PASS disc outer paper shape clips corner content
PASS roundRect default radius follows LabelShop fixed 1mm rule
PASS roundRect preview path uses the shared 1mm arc
PASS rect paper path has zero outer radius
PASS circle paper path uses width and height as diameters
PASS circle with a hole uses the hole diameter in the shared path
PASS renderLabel clips the default roundRect corner with the shared radius
PASS rectangle hole shape survives save/open normalization
PASS print scene forwards the rectangle hole shape to output
PASS renderLabel clips the rectangle hole as a centred square
PASS circle hole leaves the square corner printed (rect and circle holes differ)
64 rendering checks passed

[PASS] test:workspace (exit=0, 4s)
> maxlabel@1.0.18 test:workspace
> electron scripts/workspace-regression.cjs
renderer: %cElectron Security Warning (Insecure Content-Security-Policy) font-weight: bold; This renderer process has either no Content Security
  Policy set or a policy with "unsafe-eval" enabled. This exposes users of
  this app to unnecessary security risks.
For more information and help, consult
https://electronjs.org/docs/tutorial/security.
This warning will not show up
once the app is packaged.
renderer: Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true. See: https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently
PASS native window resize keeps paper fitted {
  large: { width: 927, height: 486, zoom: 0.8828571428571429 },
  small: { width: 581, height: 304, zoom: 0.5533333333333333 }
}
PASS document redraw, dimensions, rotation, rulers preserve fit and origin
PASS fit width/height center the short axis and keep long-axis gutter
PASS canvas right-click reaches the context menu callback
PASS wheel modes, centered zoom, negative rulers, manual resize, restore fit, disc clipping, editor-only hairline

[PASS] build (exit=0, 8s)
> maxlabel@1.0.18 build
> electron-vite build
vite v7.3.6 building ssr environment for production...
transforming...
✓ 35 modules transformed.
rendering chunks...
out/main/index.js  136.80 kB
✓ built in 360ms
vite v7.3.6 building ssr environment for production...
transforming...
✓ 2 modules transformed.
rendering chunks...
out/preload/index.js  8.23 kB
✓ built in 20ms
vite v7.3.6 building client environment for production...
transforming...
✓ 151 modules transformed.
rendering chunks...
../../out/renderer/index.html                      0.50 kB
../../out/renderer/assets/index-BTVQhgtq.css       9.89 kB
../../out/renderer/assets/fabric-BWsEBtPp.js     377.04 kB
../../out/renderer/assets/xlsx-B9fgUmyE.js       987.69 kB
../../out/renderer/assets/index-C14DwfZh.js    1,606.16 kB
../../out/renderer/assets/barcode-CxklNei4.js  1,647.24 kB
✓ built in 6.69s

[PASS] test:ui (exit=0, 1780s)
ui-v108.cjs : 8/8 : 8/8 PASS
ui-v109.cjs : 21/21 : 21/21 PASS
ui-v110.cjs : 18/18 : 18/18 PASS
ui-v111.cjs : 16/16 : 16/16 PASS
ui-v112.cjs : 17/17 : 17/17 PASS
ui-v113.cjs : 7/7 : 7/7 PASS
ui-v114.cjs : 8/8 : 8/8 PASS
ui-v115.cjs : 7/7 : 7/7 PASS
ui-v116.cjs : 12/12 : 12/12 PASS
ui-v117.cjs : 12/12 : 12/12 PASS
ui-v118.cjs : 9/9 : 9/9 PASS
ui-v119.cjs : 36/36 : 36/36 PASS
ui-v120.cjs : 14/14 : 14/14 PASS
ui-v121.cjs : 12/12 : 12/12 PASS
ui-v122.cjs : 20/20 : 20/20 PASS
ui-v123.cjs : 17/17 : 17/17 PASS
ui-v124.cjs : 11/11 : 11/11 PASS
ui-v125.cjs : 17/17 : 17/17 PASS
ui-v126.cjs : 10/10 : 10/10 PASS
ui-v127.cjs : 5/5 : 5/5 PASS
ui-v128.cjs : 2/2 : 2/2 PASS
ui-v129.cjs : 17/17 : 17/17 PASS
ui-v130.cjs : 14/14 : 14/14 PASS
ui-v131.cjs : 16/16 : 16/16 PASS
ALL SCRIPTS PASSED (82/82)

[PASS] parity:matrix (exit=0, 1s)
=== parity/matrix.md 校验 ===
总条目：605
按章节 / 状态：
  A 界面与操作习惯          共 272 条：已实现=272
  B 编辑器对象能力          共 141 条：已实现=141
  C 数据源与数据库          共 101 条：已实现=101
  D 打印链路             共  75 条：已实现=75
  E 其他               共  16 条：已实现=16
合计：已实现 605 / 部分 0 / 未实现 0 / 待核 0（覆盖率 100%）
校验通过：编号、状态、证据、出处文件均合规。


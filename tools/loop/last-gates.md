# 门禁结果（round-83）

- 时间：2026-09-16 21:37:11
- HEAD：134f8474b7bb39d041c28ce728e96f0b42d0ab3e
- 结论：全部通过

[PASS] typecheck (exit=0, 3s)
> maxlabel@0.1.0 typecheck
> npm run typecheck:node && npm run typecheck:web
> maxlabel@0.1.0 typecheck:node
> tsc --noEmit -p tsconfig.node.json
> maxlabel@0.1.0 typecheck:web
> tsc --noEmit -p tsconfig.web.json

[PASS] test:architecture (exit=0, 0s)
> maxlabel@0.1.0 test:architecture
> node scripts/architecture-check.cjs
7 architecture checks passed

[PASS] test:editor (exit=0, 1s)
> maxlabel@0.1.0 test:editor
> esbuild scripts/editor-operations.test.ts --bundle --platform=node --format=cjs --outfile=scripts/_editor.cjs && node scripts/_editor.cjs && node -e "require('fs').unlinkSync('scripts/_editor.cjs')"
  scripts\_editor.cjs  25.2kb
Done in 47ms
32 editor operation checks passed

[PASS] test:geometry (exit=0, 1s)
> maxlabel@0.1.0 test:geometry
> esbuild scripts/editor-geometry.test.ts --bundle --platform=node --format=cjs --outfile=scripts/_geometry-test.cjs && node scripts/_geometry-test.cjs && node -e "require('fs').unlinkSync('scripts/_geometry-test.cjs')"
  scripts\_geometry-test.cjs  2.0mb
Done in 109ms
1 editor geometry check passed

[PASS] test:history (exit=0, 1s)
> maxlabel@0.1.0 test:history
> esbuild scripts/document-history.test.ts --bundle --platform=node --format=cjs --outfile=scripts/_history.cjs && node scripts/_history.cjs && node -e "require('fs').unlinkSync('scripts/_history.cjs')"
  scripts\_history.cjs  3.8kb
Done in 3ms
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
共通过 109 项断言组。

[PASS] test:render (exit=0, 1s)
PASS arc changes output pixels
PASS editor object geometry and preview pixels match
PASS command text bitmap matches thresholded shared renderer pixel-for-pixel
PASS missing image fails output instead of silently printing incomplete label
PASS LSDX fixture preserves label dimensions
PASS LSDX fixture imports groups and basic object types
PASS LSDX fixture imports basic table geometry
PASS LSDX fixture imports basic RFID parameters
PASS LabelShop form shape and centre hole import
PASS rect paper settings survive save/open normalization
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
46 rendering checks passed

[PASS] test:workspace (exit=0, 4s)
> maxlabel@0.1.0 test:workspace
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

[PASS] build (exit=0, 7s)
> maxlabel@0.1.0 build
> electron-vite build
vite v7.3.6 building ssr environment for production...
transforming...
✓ 34 modules transformed.
rendering chunks...
out/main/index.js  123.92 kB
✓ built in 330ms
vite v7.3.6 building ssr environment for production...
transforming...
✓ 2 modules transformed.
rendering chunks...
out/preload/index.js  8.07 kB
✓ built in 17ms
vite v7.3.6 building client environment for production...
transforming...
✓ 144 modules transformed.
rendering chunks...
../../out/renderer/index.html                      0.50 kB
../../out/renderer/assets/index-BTVQhgtq.css       9.89 kB
../../out/renderer/assets/fabric-CFcfjq3M.js     377.03 kB
../../out/renderer/assets/xlsx-B9fgUmyE.js       987.69 kB
../../out/renderer/assets/index-Bxa0EeyT.js    1,480.01 kB
../../out/renderer/assets/barcode-CxklNei4.js  1,647.24 kB
✓ built in 5.25s

[PASS] test:ui (exit=0, 1158s)
ui-v84.cjs : 4/4 : 4/4 PASS
ui-v85.cjs : 7/7 : 7/7 PASS
ui-v86.cjs : 6/6 : 6/6 PASS
ui-v87.cjs : 3/3 : 3/3 PASS
ui-v88.cjs : 6/6 : 6/6 PASS
ui-v89.cjs : 4/4 : 4/4 PASS
ui-v90.cjs : 14/14 : 14/14 PASS
ui-v91.cjs : 16/16 : 16/16 PASS
ui-v92.cjs : 11/11 : 11/11 PASS
ui-v93.cjs : 28/28 : 28/28 PASS
ui-v94.cjs : 14/14 : 14/14 PASS
ui-v95.cjs : 16/16 : 16/16 PASS
ui-v96.cjs : 22/22 : 22/22 PASS
ui-v97.cjs : 16/16 : 16/16 PASS
ui-v98.cjs : 28/28 : 28/28 PASS
ui-v99.cjs : 27/27 : 27/27 PASS
ui-v100.cjs : 27/27 : 27/27 PASS
ui-v101.cjs : 28/28 : 28/28 PASS
ui-v102.cjs : 27/27 : 27/27 PASS
ui-v103.cjs : 9/9 : 9/9 PASS
ui-v104.cjs : 14/14 : 14/14 PASS
ui-v105.cjs : 13/13 : 13/13 PASS
ui-v106.cjs : 34/34 : 34/34 PASS
ui-v107.cjs : 28/28 : 28/28 PASS
ALL SCRIPTS PASSED (56/56)

[PASS] parity:matrix (exit=0, 1s)
=== parity/matrix.md 校验 ===
总条目：605
按章节 / 状态：
  A 界面与操作习惯          共 272 条：已实现=260  部分=12
  B 编辑器对象能力          共 141 条：已实现=140
  C 数据源与数据库          共 101 条：已实现=101
  D 打印链路             共  75 条：已实现=73  部分=2
  E 其他               共  16 条：已实现=7  部分=7  未实现=2
合计：已实现 581 / 部分 22 / 未实现 2 / 待核 0（覆盖率 100%）
校验通过：编号、状态、证据、出处文件均合规。


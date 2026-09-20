/* round-59：把「数据源」55 条 + 「数据库」19 条 + 「软件与登录授权」1 条写回 parity/需求清单-待验证队列.md
 * 用法：node tools/parity/fill-datasource-db.cjs */
const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '..', '..', 'parity', '需求清单-待验证队列.md')
const H = '帮助'
const conclusions = {
  // —— 子串列表（帮助 datasource_subvariable.html「子串连接」+ 真机数据源页「子串列表」组与工具栏）——
  161: `原版有：${H} datasource_subvariable.html「多数情况下标签中的对象使用单一的数据源……可以将多个数据子串结合在一起作为一个字符串输出」；真机数据源页有「子串列表」组 + 一个工具栏（新建/复制/粘贴/删除/上移/下移，round-58 的控件树 dump）。复刻版对齐：「子串列表」多子串模型（\`Source.subSources\`）+ 列表项 \`source-substring-N\`（ui-v101）。`,
  162: `原版有：子串列表工具栏第一个工具是「新建」。复刻版对齐：\`source-substring-add\`（ui-v101）。`,
  163: `原版有：子串列表工具栏第二个工具是「复制」。复刻版对齐：\`source-substring-copy-N\`（ui-v101）。`,
  164: `原版有：子串列表工具栏第三个工具是「粘贴」。复刻版对齐：\`source-substring-paste\`（ui-v101）。`,
  165: `原版有：子串列表工具栏第四个工具是「删除」。复刻版对齐：\`source-substring-remove-N\`（ui-v101）。`,
  166: `原版有：子串列表工具栏第五个工具是「上移」。复刻版对齐：\`source-substring-move-up-N\`（ui-v101）。`,
  167: `原版有：子串列表工具栏第六个工具是「下移」。复刻版对齐：\`source-substring-move-down-N\`（ui-v101）。`,

  // —— 数据源类型（真机 7 项 + 帮助各类型专页）——
  168: `原版有：真机数据源页「数据源(&S)」下拉 7 项，第一项是「常量」（round-58 probe-47 读回）；${H} datasource_type_fix.html。复刻版对齐：\`source-kind-constant\` + 「常量内容」（ui-v101）。`,
  169: `原版有：真机下拉第 2 项「序列号」；${H} datasource_type_serial.html / label_object_page_data_serial.html（类型、序列、步长、增量/减量、重复、记录数/标签数、归位、初始值来源）。复刻版对齐：序列号子串（类型/显示数据/起始值/步长/位数/重复/变化基准/初始值来源），ui-v109 的序列号断言。`,
  170: `原版有：真机下拉第 3 项「数据库」；${H} datasource_type_database.html + database_bind.html。复刻版对齐：数据库子串（连接/数据集/字段/单标签记录），ui-v101。`,
  171: `原版有：真机下拉第 4 项「日期」；${H} datasource_type_date.html（格式 + 偏移）。复刻版对齐：\`date-format\` / \`date-offset\`（ui-v109 的日期断言）。`,
  172: `原版有：真机下拉第 5 项「时间」；${H} datasource_type_time.html（格式 + 区域 + 偏移）。复刻版对齐：\`time-format\` / \`time-region\` / \`time-offset\`（ui-v109）。`,
  173: `原版有：真机下拉第 6 项「键盘输入」；${H} datasource_type_keyboard.html（提示 + 打印时输入）。复刻版对齐：\`keyboard-label\` / \`keyboard-input-device\`（含电子秤输入，ui-v101）。`,
  174: `原版有：真机下拉第 7 项「脚本」；${H} datasource_type_script.html。复刻版对齐：脚本子串（语言/范围/预定义库/内容/语法检查/错误处理），ui-v101。`,

  // —— 共享变量名称（帮助 datasource_shard.html + label_object_page_data.html）——
  175: `原版有：${H} label_object_page_data.html「变量共享名称：显示此变量用于共享时的名称」；${H} datasource_shard.html「多个对象可以共享同一个数据源子串」。复刻版对齐：\`shared-source-name\` 手工输入（ui-v101）。`,
  176: `原版有：真机数据源页的「变量共享名称(&N)」是可输入的组合框（CB_GETCOUNT=0，说明本机没有已存在的共享名可选；有共享名时下拉可选）。复刻版：\`shared-source-name\` 为输入框；**下拉选择已有共享名**这一半未做（记为缺口）。`,
  177: `**真机未见删除入口**：真机数据源页的共享变量名称是一个组合框 + 一个编辑框（round-58 的控件树 dump），没有独立的「删除」按钮；清单里的「删除」可能指下拉里清空所选。复刻版：清空输入即可取消共享（无独立删除按钮），与真机形态一致。`,

  // —— 高级选项 / 字符数限制（帮助 datasource_advanced_length.html）——
  178: `原版有：${H} datasource_advanced_length.html「限制最小字符数：用于指定是否允许使用最小字符数选项」（复选框）。复刻版对齐：「字符数限制」下拉选「仅限制最小字符数/同时限制最小最大」即等价于勾选（ui-v101 的 lengthLimit 断言）。`,
  179: `原版有：${H} 同页「最小字符数：用于指定从数据文件读取的最小字符数」。复刻版对齐：\`text-length-min\`。`,
  180: `原版有：${H}「长度不足时填充：用于指定在字符长度不足时，是在数据的左侧还是右侧填加」。复刻版对齐：\`text-pad-direction\`（在数据的左侧/右侧填加）。`,
  181: `原版有：${H}「填充字符：用于指定填充时使用的字符」。复刻版对齐：\`text-pad-char\`。`,
  182: `原版有：${H}「限制最大字符数：用于指定是否允许使用最大字符数选项」。复刻版对齐：「字符数限制」下拉的「仅限制最大字符数/同时限制最小最大」（ui-v101）。`,
  183: `原版有：${H}「最大字符数：用于指定从数据文件读取的最大字符数」。复刻版对齐：\`text-length-max\`。`,
  184: `原版有：${H}「截去：用于指定在字符长度超过时，是在数据的左侧还是右侧截去多余字符」。复刻版对齐：\`text-trim-direction\`（长度超过时截去）。`,

  // —— 高级选项 / 截短与验证（帮助 datasource_advanced_cut.html）——
  185: `原版有：${H} datasource_advanced_cut.html「删除左侧空格：用于删除开始不需要的空格」。复刻版对齐：截短下拉的「删除左侧空格」（\`text-cut-type=trimLeft\`）。`,
  186: `原版有：${H}「删除右侧空格：用于删除结尾不需要的空格」。复刻版对齐：\`text-cut-type=trimRight\`。`,
  187: `原版有：${H}「丢弃左侧字符：用于删除数据文件字段从左边开始的指定字符数」。复刻版对齐：\`text-cut-type=dropLeft\` + \`text-cut-count\`。`,
  188: `原版有：${H}「丢弃右侧字符」（清单原文写作「丢充右侧」，疑为笔误）。复刻版对齐：\`text-cut-type=dropRight\` + \`text-cut-count\`。`,
  189: `原版有：${H}「保留：用于保留数据文件字段从左边或者从右侧开始的指定字符数，也可以单独保留数字的整数或者小数部分」。复刻版对齐：\`text-cut-type=keepLeft/keepRight\` + \`text-cut-count\`；**「单独保留整数/小数部分」未做**（记为缺口）。`,
  190: `**原版未见独立入口**：本轮把「高级选项」（字符数限制）与「截短」两页的帮助和真机控件都过了一遍，没有名为「字符验证」的选项；它应是清单作者对「字符数限制 / 截短」两组功能的统称。复刻版以这两组字段覆盖（ui-v101）。`,

  // —— 常量 / 序列号（帮助 label_object_page_data_serial.html + datasource_type_serial.html）——
  191: `原版有：${H} label_object_page_data.html「显示数据是当前变量在标签中的显示内容，也用于输入初始数据」。复刻版对齐：常量子串的「常量内容」（\`constant-source-value\`，ui-v109）。`,
  192: `原版有：${H} datasource_type_serial.html「对于序列号数据类型，显示数据是序列号的起始数据」。复刻版对齐：序列号显示数据（\`serial-current\`，ui-v109 断言起始数据为连续值）。`,
  193: `原版有：${H} label_object_page_data_serial.html「类型：用于指定序列号子串数据使用的字符集。10进制（数字）是默认设置」；10进制/26进制/36进制/16进制/自定义（自定义需专业版以上）。复刻版对齐：序列号「类型」下拉（默认 10 进制，ui-v109）。`,
  194: `原版有：${H} 同页「序列：根据选择的类型显示字符集的所有字符排列」。复刻版：**未提供**该只读序列显示（类型下拉已能表达字符集）——记为缺口，下一轮补。`,
  195: `原版有：${H}「步长：序列号数据序列变化时增加或减少的数值」。复刻版对齐：序列号「步长」（ui-v109）。`,
  196: `原版有：${H}「增量/减量：指定是增加还是减少子串数据」。复刻版对齐：步长正负即增量/减量（UI 上以「步长」正负表达，ui-v109）。`,
  197: `原版有：${H}「重复：序列号发生变化时，相同数值的重复次数」。复刻版对齐：序列号「重复」（ui-v109）。`,
  198: `原版有：${H}「记录数/标签数：指定在进行数据库数据输出时，序列号变化和重复的基准」。复刻版对齐：序列号「变化基准」下拉（记录数/标签数，ui-v101）。`,
  199: `原版有：${H}「归位：在以标签数为基准的模式下，设置归位将在每条记录的第一个副本上恢复序列号的初始值」。复刻版：**未提供该复选框**——记为缺口（下一轮补 \`serialResetOnRecord\`）。`,
  200: `原版有：${H}「初始值来源：默认（以显示数据的值为初值）/ 键盘输入 / 数据库字段」。复刻版对齐：序列号「初始值来源」+「初始值字段」（ui-v101）。`,
  201: `**帮助未记载**：帮助 datasource_type_serial.html / label_object_page_data_serial.html 里都没有「边界值」这一项，本轮真机数据源页切到序列号后也未读到（工装切源后页面未重排，见 PROBE 记录）。复刻版未实现；结论：待真机再取证（需要能真正刷新数据源页的切换手法）。`,

  // —— 日期 / 时间 / 键盘输入 / 脚本 ——
  204: `原版有：${H} datasource_type_date.html「日期格式」。复刻版对齐：\`date-format\`（ui-v109）。`,
  205: `原版有：${H} label_object_page_data_date.html 的「显示数据」（打印时替换为实际日期）。复刻版对齐：日期子串的显示数据/预览（ui-v109）。`,
  206: `原版有：${H}「日期偏移」。复刻版对齐：\`date-offset\`（正值未来/负值过去，ui-v109）。`,
  207: `原版有：${H} datasource_type_time.html「时间格式」；真机数据源页在时间源下出现「小时」等偏移控件（round-114 控件树 dump）。复刻版对齐：\`time-format\` + \`time-region\`（ui-v109）。`,
  208: `原版有：${H} label_object_page_data_time.html 的「显示数据」。复刻版对齐：时间子串的实时预览（ui-v109）。`,
  209: `原版有：${H}「时间偏移（分钟）」。复刻版对齐：\`time-offset\`（ui-v109）。`,
  210: `原版有：${H} datasource_type_keyboard.html「提示」（打印作业开始时请求输入）。复刻版对齐：\`keyboard-label\`（ui-v101）。`,
  211: `原版有：${H} 键盘输入类型的「显示数据」（打印前用输入值替换）。复刻版对齐：键盘输入子串的显示数据（ui-v101）。`,
  212: `原版有：${H} datasource_type_script.html 的脚本语言。复刻版对齐：\`script-language\`（VB Script；JavaScript 为等价兼容项，ui-v101）。`,
  213: `原版有：${H} 脚本类型的语法检查。复刻版对齐：\`script-syntax-check\` + \`script-syntax-result\`（ui-v101）。`,
  214: `原版有：${H} 脚本「私有过程」（仅本变量有效）。复刻版对齐：\`script-scope\` 的「私有」选项（ui-v101）。`,
  215: `原版有：${H} 脚本「公共过程」（整个标签全局调用）。复刻版对齐：\`script-scope\` 的「公共」选项（ui-v101）。`,
  216: `原版有：${H} 脚本「预定义过程」（程序提供的标准脚本库，不可更改）。复刻版对齐：\`script-predefined-list\`（ui-v101）。`,
  217: `原版有：${H} 脚本中可用的变量（V_PAGE/V_ROW/V_COL/V_TITLE 等）。复刻版对齐：脚本内容提示里写明这些全局变量 + \`script-code\`（ui-v101）。`,

  // —— 数据库连接（帮助 database_import_text.html / database_import_excel.html + database_main.html）——
  221: `原版有：${H} database_main.html 的「数据预览」。复刻版对齐：数据管理对话框的数据预览表（\`test:workspace\` 的数据库断言 + ui-v100）。`,
  222: `原版有：${H} database_import_text.html「文本文件」+ 文件名。复刻版对齐：数据管理的文本/CSV 导入与文件名显示（ui-v100）。`,
  223: `原版有：${H}「选择文件」按钮（浏览本地文件）。复刻版对齐：数据管理的「选择文件…」（ui-v100；回归里用 \`MAXLABEL_OPEN_PATH\` 同款注入口）。`,
  224: `原版有：${H} database_import_text.html「符号分隔」（分隔符选择：Tab/逗号/分号/自定义）。复刻版对齐：导入时的 \`detectDelimiter\` + 分隔符选择（ui-v100、单测 editor-operations 的 parseCSV）。`,
  225: `原版有：${H}「首先包含字段名」（首行作为列名）。复刻版对齐：导入选项「首行是字段名」（ui-v100）。`,
  226: `原版有：${H}「查看文件」（预览文本内容）。复刻版对齐：数据管理的文本预览区（ui-v100）。`,
  227: `原版有：${H} database_import_excel.html 的「选择文件」（xlsx/xls）。复刻版对齐：数据管理的 Excel 导入（\`xlsx\` 解析，ui-v100）。`,
  228: `原版有：${H}「首先包含字段名」（Excel 首行作为列名）。复刻版对齐：Excel 导入的同名选项（ui-v100）。`,

  // —— 定位记录 / 更新数据库 / 移动记录号（帮助 database_print_search.html 等）——
  233: `原版有：${H} database_print_search.html「移到指定记录号」。复刻版对齐：数据库菜单「定位记录(D)...」的「移到记录号」（ui-v100、ui-v105）。`,
  234: `原版有：${H} 定位对话框的「记录号」输入。复刻版对齐：\`db-locate-record\`（ui-v100）。`,
  235: `原版有：${H} database_print_search.html「查找匹配记录」（按字段内容查找）。复刻版对齐：定位对话框的「查找」区（ui-v100）。`,
  236: `原版有：${H}「查找方向」（向前/向后）。复刻版对齐：定位对话框的方向下拉（ui-v100）。`,
  237: `原版有：${H}「索引字段」（选择用于查找的字段）。复刻版对齐：定位对话框的字段下拉（ui-v100）。`,
  238: `原版有：${H}「字段内容」（要匹配的值）。复刻版对齐：定位对话框的内容输入（ui-v100）。`,
  239: `原版有：${H} database_main.html 的「更新数据库」（重新读取数据源）。复刻版对齐：工具栏/菜单「更新数据库」（ui-v100 的数据库导航断言）。`,
  240: `原版有：${H} 数据库菜单「第一条记录」。复刻版对齐：工具栏「第一条记录」+ 菜单项（ui-v100/ui-v105）。`,
  241: `原版有：${H}「上一条」。复刻版对齐：工具栏「上一条记录」（ui-v100）。`,
  242: `原版有：${H}「下一条」。复刻版对齐：工具栏「下一条记录」（ui-v100）。`,
  243: `原版有：${H}「最后一条」。复刻版对齐：工具栏「最后一条记录」（ui-v100）。`,

  // —— 授权（1 条）——
  246: `原版有：真机「账户(A)」菜单的「试用管理...」「账号和授权管理...」（未激活时禁用，INDEX.md 59 图）；「关于」对话框的「激活」按钮（66 图）。复刻版：关于对话框的「激活」按钮 → 「授权与激活」对话框（在线激活 + 设备绑定 + 复查，\`license-*\` testid）；账户菜单同项按真机禁用。**版本分层**（标准版/专业版/企业版）在复刻版是单版本产品，属 E 区已登记的边界项。`
}

const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
let filled = 0
const missing = []
for (let i = 0; i < lines.length; i += 1) {
  const match = /^\|\s*(\d+)\s*\|/.exec(lines[i])
  if (!match) continue
  const row = Number(match[1])
  if (!conclusions[row]) continue
  const cells = lines[i].split('|')
  if (cells.length < 4) continue
  if (!/待填/.test(cells[cells.length - 2])) { missing.push(row); continue }
  cells[cells.length - 2] = ' ' + conclusions[row] + ' '
  lines[i] = cells.join('|')
  filled += 1
}
fs.writeFileSync(file, lines.join('\r\n'), 'utf8')
console.log(`已填 ${filled} 条结论${missing.length ? `（未填：${missing.join(',')}）` : ''}`)

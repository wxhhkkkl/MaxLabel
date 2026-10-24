import type { Language } from './types'

export type HelpKey = 'start' | 'object' | 'source' | 'db' | 'print' | 'installprinter' | 'shortcut' | 'faq'

export interface HelpItem {
  t: string
  d: string
}

export interface HelpSection {
  key: HelpKey
  title: string
  intro: string
  items: HelpItem[]
}

export const HELP_KEYS: readonly HelpKey[] = [
  'start',
  'object',
  'source',
  'db',
  'print',
  'installprinter',
  'shortcut',
  'faq'
]

const zhCN: HelpSection[] = [
  {
    key: 'start',
    title: '快速开始',
    intro: '创建标签模板并完成第一次打印的最小流程。',
    items: [
      { t: '新建模板', d: '点击工具栏"新建标签模版"或按 Ctrl+N，选择标签格式（宽度/高度，单位毫米或英寸），确定后进入编辑界面。' },
      { t: '打开模板', d: '"打开标签模版"或 Ctrl+O 选择本地 .json 模板文件；开始页的"最近打开"与"模板库"可直接双击打开。' },
      { t: '保存模板', d: 'Ctrl+S 保存为 .json 文件（含对象、数据源、打印机设置、拼版布局）。也可保存到模板库，模板库卡片显示缩略图预览。' },
      { t: '标签格式设置', d: '工具栏"标签格式设置"按钮或快捷键打开对话框：可设标签宽高、方向（旋转 90/180/270）、单位与拼版行列、水平间距/垂直间距、形状、孔洞、打印顺序（先行后列/先列后行）。' },
      { t: '打印', d: '底部打印面板：选择打印机（Windows 驱动或指令直连）、打印数量、单签拷贝、起始标签；数据库打印还可选择当前记录、查重和打印后是否更新序列号，然后"打印预览"或"打印"。' }
    ]
  },
  {
    key: 'object',
    title: '对象设计',
    intro: '文字、条码、图形、表格、RFID 等对象的创建与编辑。',
    items: [
      { t: '对象创建', d: '工具栏选择"选取/条码/文字/线条/斜线/矩形/图片/数据/表格"工具后，在画布上点击或拖拽创建对象。' },
      { t: '选中与句柄', d: '单击选中对象显示蓝色实心句柄；按住 Ctrl 单击多选；框选空白处拖拽虚线框批量选中。多选时第一个对象（参考对象）蓝色句柄、其余深色句柄。' },
      { t: '双击属性', d: '双击对象打开"对象属性"对话框（也可右键→属性或 Alt+Enter）。属性对话框按对象类型细分页签：文字=数据源/外观/文本/常规；条码=数据源/条码/文本/常规；RFID=数据源/RFID/常规；表格=表格/常规；图形=外观/常规；图片=图片/常规。' },
      { t: '对齐与排列', d: '"排列"菜单或对齐工具栏：左/右/上/下/垂直中齐/水平中齐、旋转、尺寸同宽同高、水平/垂直居中、间距相同、层次（移到最前/前移/后移/移到最后）、贴到标签边。' },
      { t: '组合与锁定', d: 'Ctrl+G 组合多对象为组，Ctrl+U 取消组合；Ctrl+L 锁定位置（锁定后不可移动/对齐）。' },
      { t: '表格对象', d: '表格对象可设行数/列数、边框宽度、边框颜色，常用于货架标签、配方表等结构化排版。' },
      { t: '图片对象', d: '插入图片后可在属性对话框"图片"页签更换图片；宽高（毫米）在"常规"页签调整。' },
      { t: 'RFID 对象', d: 'RFID 标签可写入 EPC/USER/TID 区，支持写后锁定与 Access/Kill 口令；指令打印时按指令集输出写卡命令（具体行为随打印机固件而定）。' }
    ]
  },
  {
    key: 'source',
    title: '数据源',
    intro: '对象的文字/条码内容可由 7 类数据源驱动，实现可变数据。',
    items: [
      { t: '常量', d: '固定文本，所有标签输出相同内容。' },
      { t: '序列号', d: '支持起始值、步长、位数补零、自定义字符集（如 0-9A-Z）与循环；打印后自动推进并回写保存，便于连续编号。' },
      { t: '数据库', d: '从数据集按记录取值，配合打印数量逐记录输出；可在打印面板选择当前数据集与起始记录。' },
      { t: '日期 / 时间', d: '输出当前日期或时间，支持多种格式（yyyy-MM-dd、HH:mm:ss 等），可按需选择。' },
      { t: '键盘输入', d: '打印前弹出对话框逐个输入提示标签对应的值（可设置输入顺序与提示文字），常用于称重、批次号等现场输入。' },
      { t: '脚本', d: 'JS 脚本数据源：通过 OnBeginPrint()/OnGetData() 回调动态返回内容，内置变量 V_PAGE、V_LABELNO、V_COPY、V_ROW、V_COL、V_TOTALLABELS、V_TITLE、V_PRINTER 与共享变量。' },
      { t: '子串与格式化', d: '文本对象可设置子串（起始/长度）截取内容，大小写转换（全部大写/小写/首字母大写），仅影响打印输出。' },
      { t: '共享变量', d: '脚本数据源可声明命名共享变量，供其它脚本或后续打印引用，实现跨对象联动。' }
    ]
  },
  {
    key: 'db',
    title: '数据库',
    intro: '连接外部数据批量生成标签。',
    items: [
      { t: '连接类型', d: '支持文本文件（逗号/制表符分隔）、Excel、ODBC（SQL Server/Oracle）与内置 SQLite；可建立多个连接。' },
      { t: '字段映射', d: '在"数据管理"对话框可为每个字段设置别名，作为数据源内容引用；含表头行与数据预览。' },
      { t: '记录导航', d: '工具栏与"数据库"菜单支持第一条/上一条/下一条/最后一条、定位记录（Ctrl+F）、更新数据库、删除数据库。' },
      { t: '批量打印', d: '打印数量指定输出记录数，每条记录生成一张标签；可设置起始记录。' }
    ]
  },
  {
    key: 'print',
    title: '打印输出',
    intro: '两种打印方式与参数详解。',
    items: [
      { t: '驱动打印', d: '走 Windows 打印机驱动（图形打印），弹出系统打印对话框，兼容激光/喷墨等页式打印机；推荐给不支持指令集的普通打印机。' },
      { t: '指令直连', d: 'TSPL/ZPL/CPCL 等指令集直发标签打印机，支持文件/TCP/COM/LPT/蓝牙（SPP 虚拟串口）；USB 请安装驱动或映射为 COM 端口。国产主流标签机（佳博、汉印、芯烨等）兼容；专业机型效果最佳。' },
      { t: '打印数量 × 单签拷贝', d: '打印数量控制可变数据推进的张数；单签拷贝为同一张的重复份数。实际输出 = 打印数量 × 单签拷贝。' },
      { t: '起始标签', d: '页式机从第 N 张标签开始打印。' },
      { t: '测试打印', d: '打印 1 张，不写日志、不推进序列号，用于验证版式。' },
      { t: '指令打印到文件', d: '打印机端口选择"打印到文件"时，将生成的指令保存为 .prn/.txt 文件，供设备调试或批量下发。' },
      { t: '打印历史', d: '每次打印记录日志（含测试标记），可在"打印历史记录"对话框查看详情、导出 CSV、清空。' }
    ]
  },
  {
    key: 'installprinter',
    title: '安装打印机',
    intro: '签赋MaxLabel 自带一批条码标签打印机的输出条目（品牌 + 指令集 + 分辨率），安装后即可直接打印，无需为这些机型另装 Windows 驱动。',
    items: [
      { t: '安装/移除', d: '在「选择标签格式」页点「安装(I)」打开「安装 MaxLabel 打印机」：先按品牌过滤，再在列表里选中型号（形如 Gprinter GPL-N (203 dpi)），点「安装」登记、点「移除」卸载；已安装的行在「状态」列显示「已安装」。' },
      { t: '指令集', d: '打印指令集又称打印控制命令集；计算机通过打印控制语言，以软件命令的方法来控制打印机操作，解释执行打印数据，获得打印结果。不同品牌打印指令集可能不同，相同品牌不同型号的打印机指令集也可能不同，甚至一台打印机也可以集成多套指令集。' },
      { t: '未收录型号', d: '在签赋MaxLabel中如果没有收录的型号，可分别尝试使用 ZPL、TSPL 或 CPCL 这三套指令集；签赋MaxLabel不保证没有适配的品牌输出结果。' },
      { t: '分辨率', d: '条码标签打印机分辨率指打印头横向上每英寸最多能打印的点数（dpi）；通用分辨率为 203dpi、300dpi、600dpi 三种，越高越清晰。' },
      { t: '分辨率不匹配', d: '分辨率与打印机不匹配时，在指令集正确的前提下仍可输出，但输出比例会变大或缩小：输出比例变大说明安装的分辨率比实际小，改选小分辨率即可；输出比例缩小说明安装的分辨率比实际大，改选大分辨率即可。' },
      { t: '充分发挥性能', d: '安装 MaxLabel 打印机可以在MaxLabel中实现一般的标签打印功能；如果想充分发挥打印机的性能，请安装官方提供的驱动程序。' }
    ]
  },
  {
    key: 'shortcut',
    title: '快捷键',
    intro: '常用快捷键一览。',
    items: [
      { t: '文件', d: 'Ctrl+N 新建、Ctrl+O 打开、Ctrl+S 保存、Ctrl+W 关闭、Ctrl+E 导出条码图片、Ctrl+P 打印。' },
      { t: '编辑', d: 'Ctrl+Z 撤销、Ctrl+Y 恢复、Ctrl+X 剪切、Ctrl+C 复制、Ctrl+V 粘贴（偏移 1mm）、Delete 删除、Ctrl+A 全选、Alt+Enter 属性、Ctrl+G 组合、Ctrl+U 取消组合、Ctrl+L 位置锁定。' },
      { t: '对象操作', d: '方向键微调选中对象（Shift+方向键大步长）；双击对象打开属性；Ctrl+T 循环选中对象。' },
      { t: '视图', d: 'Ctrl+R 显示对象信息、Ctrl+F 定位记录、Ctrl+=/Ctrl+- 放大缩小、Ctrl+Alt+0 撑满窗口；空格+拖拽平移画布。' },
      { t: '帮助', d: 'F1 帮助主题。' }
    ]
  },
  {
    key: 'faq',
    title: '常见问题',
    intro: '使用中的常见疑问。',
    items: [
      { t: '打印内容与预览不一致？', d: '指令打印时中文/弧形文字/非常规码制可能因打印机字体缺失而不同，请优先使用位图输出或核对打印机内建字体；预览为模拟显示。' },
      { t: '打出的条码扫不出？', d: '检查码制内容是否符合规范（EAN/UPC 位数）、窄条宽度与宽条比例、打印浓度；指令直连时确认分辨率（203/300/600dpi）与打印机一致。' },
      { t: '序列号不递增？', d: '确认数据源为"序列号"类型且打印为正式打印（测试打印不推进）；打印后序列号自动回写保存。' },
      { t: '无法直连 USB 打印机？', d: '尝试切换为"Windows 打印机驱动"方式，或确认打印机已安装对应驱动/USB 虚拟串口识别。' },
      { t: '云端功能为何不可用？', d: '云端模板库、打印服务连接等能力需要先配置服务地址和账号；本地模板、数据源与打印功能不受影响。' }
    ]
  }
]

const enUS: HelpSection[] = [
  {
    key: 'start',
    title: 'Quick Start',
    intro: 'The shortest path from creating a label template to the first print.',
    items: [
      { t: 'Create a template', d: 'Click "New Label Template" on the toolbar or press Ctrl+N, choose the label format (width/height in millimetres or inches), and confirm to enter the editor.' },
      { t: 'Open a template', d: 'Use "Open Label Template" or Ctrl+O to choose a local .json template. Recent templates and the template library on the start page can be opened by double-clicking.' },
      { t: 'Save a template', d: 'Ctrl+S saves a .json file containing objects, data sources, printer settings and imposition layout. You can also save to the template library; library cards show a thumbnail preview.' },
      { t: 'Label format', d: 'Open the label format dialog from the toolbar or shortcut: set label width/height, orientation (90/180/270 rotation), unit and imposition rows/columns, horizontal/vertical gaps, shape, hole and print order (row-first or column-first).' },
      { t: 'Print', d: 'The print panel at the bottom lets you choose a printer (Windows driver or direct commands), print count, copies per label and start label. Database printing can also use the current record, duplicate checking and post-print serial updates; then use Print Preview or Print.' }
    ]
  },
  {
    key: 'object',
    title: 'Object Design',
    intro: 'Create and edit text, barcodes, shapes, tables and RFID objects.',
    items: [
      { t: 'Create objects', d: 'Choose the Select/Barcode/Text/Line/Diagonal/Rectangle/Image/Data/Table tool and click or drag on the canvas.' },
      { t: 'Selection and handles', d: 'Click an object to select it; selected objects show blue solid handles. Hold Ctrl and click for multi-selection, or drag a dashed box over empty canvas. In a multi-selection the first object (reference) has blue handles and the others have dark handles.' },
      { t: 'Double-click properties', d: 'Double-click an object (or right-click → Properties, or Alt+Enter) to open Object Properties. Tabs depend on the type: text = Data/Appearance/Text/General; barcode = Data/Barcode/Text/General; RFID = Data/RFID/General; table = Table/General; shape = Appearance/General; image = Image/General.' },
      { t: 'Align and arrange', d: 'Use the Arrange menu or alignment bar: left/right/top/bottom/vertical centre/horizontal centre, rotate, same width/height, horizontal/vertical centre, equal spacing, z-order (bring to front/forward/backward/send to back) and snap to label edges.' },
      { t: 'Group and lock', d: 'Ctrl+G groups selected objects, Ctrl+U ungroups, and Ctrl+L locks position (locked objects cannot be moved or aligned).' },
      { t: 'Table objects', d: 'Tables support rows/columns, border width and border colour; useful for shelf labels and structured forms.' },
      { t: 'Image objects', d: 'After inserting an image, replace it from the Image tab in Object Properties; width/height in millimetres are set on the General tab.' },
      { t: 'RFID objects', d: 'RFID labels can write EPC/USER/TID data with optional locking and Access/Kill passwords; direct command printing emits the writer commands for the selected command set (behaviour depends on printer firmware).' }
    ]
  },
  {
    key: 'source',
    title: 'Data Sources',
    intro: 'Text and barcode content can be driven by seven data source kinds for variable data.',
    items: [
      { t: 'Constant', d: 'Fixed text; every label prints the same value.' },
      { t: 'Serial', d: 'Supports start value, step, zero padding, a custom character set (for example 0-9A-Z) and repeat; the value advances and is written back after printing for continuous numbering.' },
      { t: 'Database', d: 'Reads values from a dataset record by record; choose the active dataset and start record in the print panel.' },
      { t: 'Date / Time', d: 'Prints the current date or time in configurable formats (yyyy-MM-dd, HH:mm:ss, and others).' },
      { t: 'Keyboard input', d: 'Prompts for each configured label before printing (input order and prompt text are configurable), commonly used for weights and batch numbers.' },
      { t: 'Script', d: 'A JS script data source returning content through OnBeginPrint()/OnGetData(). Built-in variables include V_PAGE, V_LABELNO, V_COPY, V_ROW, V_COL, V_TOTALLABELS, V_TITLE, V_PRINTER and shared variables.' },
      { t: 'Substring and formatting', d: 'Text objects can take a substring (start/length) and apply case conversion (upper/lower/title case); these affect printed output only.' },
      { t: 'Shared variables', d: 'Script data sources can declare named shared variables for other scripts or later printing, enabling cross-object coordination.' }
    ]
  },
  {
    key: 'db',
    title: 'Database',
    intro: 'Connect external data to generate labels in bulk.',
    items: [
      { t: 'Connection types', d: 'Supports delimited text files (comma/tab), Excel, ODBC (SQL Server/Oracle) and built-in SQLite; multiple connections are supported.' },
      { t: 'Field mapping', d: 'The Data Management dialog lets you set an alias for each field and reference it from data sources; it includes a header row and data preview.' },
      { t: 'Record navigation', d: 'The toolbar and Database menu support first/previous/next/last record, locate record (Ctrl+F), refresh database and delete database.' },
      { t: 'Batch printing', d: 'The print count sets how many records are output, one label per record; a start record can also be set.' }
    ]
  },
  {
    key: 'print',
    title: 'Printing',
    intro: 'The two print paths and their parameters.',
    items: [
      { t: 'Driver printing', d: 'Uses the Windows printer driver (graphics printing) and shows the system print dialog; compatible with laser/inkjet page printers. Recommended for ordinary printers without a supported command set.' },
      { t: 'Direct commands', d: 'Sends TSPL/ZPL/CPCL directly to label printers over file/TCP/COM/LPT/Bluetooth (SPP virtual serial). For USB, install the driver or map the printer to a COM port. Mainstream Chinese label printers (Gprinter, HPRT, Xprinter, etc.) are compatible; professional models give the best results.' },
      { t: 'Print count × copies', d: 'Print count controls how many variable-data labels are produced; copies per label repeats the same label. Actual output = print count × copies per label.' },
      { t: 'Start label', d: 'Page printers can start at label N.' },
      { t: 'Test print', d: 'Prints one label without writing a log or advancing serials, for layout verification.' },
      { t: 'Print commands to file', d: 'When the port is set to "Print to file", the generated commands are saved as a .prn/.txt file for device debugging or batch distribution.' },
      { t: 'Print history', d: 'Every print writes a log entry (including the test flag); view details, export CSV or clear the log in Print History.' }
    ]
  },
  {
    key: 'installprinter',
    title: 'Install Printer',
    intro: 'MaxLabel ships output entries for a set of barcode label printers (brand + command set + resolution). Once installed they can print without a separate Windows driver.',
    items: [
      { t: 'Install/remove', d: 'On the label-format page click Install(I) to open Install MaxLabel Printer: filter by brand, select a model (for example Gprinter GPL-N (203 dpi)), then Install to register or Remove to uninstall; installed rows show Installed in the Status column.' },
      { t: 'Command sets', d: 'A print command set (printer control language) lets the computer control printer operations and interpret print data. Command sets can differ by brand, by model within a brand, and a printer may support several command sets.' },
      { t: 'Unlisted models', d: 'For models not in the catalog, try ZPL, TSPL or CPCL in turn. MaxLabel does not guarantee output for unadapted brands.' },
      { t: 'Resolution', d: 'Barcode label printer resolution is the maximum number of dots per inch across the print head (dpi). Common values are 203 dpi, 300 dpi and 600 dpi; higher is sharper.' },
      { t: 'Resolution mismatch', d: 'If the resolution does not match the printer, output can still work with the correct command set but will be scaled: output too large means the selected resolution is lower than the printer; choose a lower value. Output too small means the selected resolution is higher; choose a higher value.' },
      { t: 'Full performance', d: 'Installing a MaxLabel printer enables general label printing inside MaxLabel. For the printer\'s full capabilities, install the official driver.' }
    ]
  },
  {
    key: 'shortcut',
    title: 'Shortcuts',
    intro: 'Common keyboard shortcuts.',
    items: [
      { t: 'File', d: 'Ctrl+N new, Ctrl+O open, Ctrl+S save, Ctrl+W close, Ctrl+E export barcode image, Ctrl+P print.' },
      { t: 'Edit', d: 'Ctrl+Z undo, Ctrl+Y redo, Ctrl+X cut, Ctrl+C copy, Ctrl+V paste (1 mm offset), Delete, Ctrl+A select all, Alt+Enter properties, Ctrl+G group, Ctrl+U ungroup, Ctrl+L lock position.' },
      { t: 'Objects', d: 'Arrow keys nudge the selection (Shift+arrow for larger steps); double-click opens properties; Ctrl+T cycles through objects.' },
      { t: 'View', d: 'Ctrl+R object info, Ctrl+F locate record, Ctrl+=/Ctrl+- zoom, Ctrl+Alt+0 fit to window; Space+drag pans the canvas.' },
      { t: 'Help', d: 'F1 opens Help Topics.' }
    ]
  },
  {
    key: 'faq',
    title: 'FAQ',
    intro: 'Common questions.',
    items: [
      { t: 'Printed output differs from the preview', d: 'With direct commands, Chinese/arc text or unusual symbologies can differ when the printer lacks the font; prefer bitmap output or check the printer built-in font. The preview is a simulation.' },
      { t: 'The barcode does not scan', d: 'Check the data against the symbology rules (EAN/UPC length), narrow-bar width and wide-bar ratio, and print density; for direct commands confirm the resolution (203/300/600 dpi) matches the printer.' },
      { t: 'Serial numbers do not advance', d: 'Confirm the source is a Serial data source and the job is a normal print (test prints do not advance). The value is written back after printing.' },
      { t: 'Cannot print directly to USB', d: 'Switch to Windows driver printing, or confirm the printer driver is installed and the USB virtual serial port is recognized.' },
      { t: 'Cloud features are unavailable', d: 'Cloud templates and print-service connections require a server address and account. Local templates, data sources and printing are unaffected.' }
    ]
  }
]

export const HELP_SECTIONS: Record<Language, HelpSection[]> = {
  'zh-CN': zhCN,
  'en-US': enUS
}

import type { Language } from './types'

export type HelpKey = 'start' | 'object' | 'source' | 'db' | 'print' | 'cloud' | 'export' | 'installprinter' | 'shortcut' | 'faq'

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
  'start', 'object', 'source', 'db', 'installprinter', 'print', 'cloud', 'export', 'shortcut', 'faq'
]

const zhCN: HelpSection[] = [
  {
    key: "start",
    title: "快速开始",
    intro: "从空白模板开始，设计并试打一张标签。",
    items: [
      {
        t: "新建并设置纸张",
        d: "点击「新建」或按 Ctrl+N。按实物填写宽高。平张纸还需核对行列与间距，最后点击「选择」。"
      },
      {
        t: "放置文字和条码",
        d: "在工具栏选择「文字」或「条码」，到画布上放置对象。双击对象打开属性，在「数据源」里输入固定内容。条码还需要在「条码」页选择码制。"
      },
      {
        t: "保存模板",
        d: "按 Ctrl+S，首次保存时选择位置和文件名，默认格式为 .msdx。已有模板可用 Ctrl+O 打开，支持 MaxLabel .msdx、兼容的 .json 和 LabelShop .lsdx。旧模板导入后请核对版式和数据绑定。"
      },
      {
        t: "选打印机并试打",
        d: "按 Ctrl+P 打开打印窗口，通过「打印机属性」核对设备和端口。用「测试打印」检查方向、位置和条码能否扫描，再设置数量正式打印。"
      },
    ]
  },
  {
    key: "object",
    title: "画布与对象",
    intro: "添加、编辑和整理标签上的元素。",
    items: [
      {
        t: "插入与选择对象",
        d: "从工具栏选择对象类型，在画布上放置。切回「选取」即可移动或缩放。拖动空白处可框选多个对象。"
      },
      {
        t: "修改对象属性",
        d: "双击对象或按 Alt+Enter 打开属性。按对象类型查看「数据源」「条码」「文本」「外观」或「常规」页。编辑条码时，在「条码」页选择码制和码高，再核对数据源中的内容能否被所选码制编码。"
      },
      {
        t: "对齐、层次与分组",
        d: "选中多个对象后，在「排列」中选择对齐、等尺寸、间距或分组。对象重叠时用前移或后移调整叠放顺序。通过图层管理组织对象。"
      },
      {
        t: "调整标签尺寸",
        d: "从「文件 → 标签格式设置」修改当前模板的宽高、方向与拼版参数。调整后检查所有对象是否仍在标签内。"
      },
    ]
  },
  {
    key: "source",
    title: "可变数据",
    intro: "同一张模板可以为每条记录生成不同的标签内容。",
    items: [
      {
        t: "固定值与序列号",
        d: "在对象属性的「数据源」页选常量，输入每张标签都相同的内容。需要流水号时选序列号，设定起始值、步长和补零位数，打印前核对起始值和更新选项。"
      },
      {
        t: "数据库字段",
        d: "先在「数据库 → 设置数据库」导入文件。双击对象，按图设置数据源。切换一条记录，确认标签内容随之更新。"
      },
      {
        t: "日期、时间与键盘输入",
        d: "日期和时间数据源按所选格式生成内容。键盘输入数据源可设置提示文字，打印前在弹窗输入批次号等值，检查后点击「确定」继续。"
      },
      {
        t: "脚本数据源",
        d: "需要计算或拼接内容时，可配置脚本数据源。先确认系统设置允许执行脚本，再用几条代表性记录验证输出。"
      },
    ]
  },
  {
    key: "db",
    title: "导入与连接数据库",
    intro: "从文件或数据库读取记录，供标签对象引用。",
    items: [
      {
        t: "导入 Excel 或文本文件",
        d: "在「数据库 → 设置数据库」选择 Excel、CSV 或 TXT。Excel 需选工作表。CSV 和 TXT 若出现乱码或错列，调整字符集或分隔符后再确认。"
      },
      {
        t: "连接 SQL 或 ODBC",
        d: "在数据库设置中按界面提供的类型配置连接，例如 MySQL、SQLite 或 SQL Server。使用 ODBC 时先安装匹配的驱动并配置数据源。测试连接后再选表或执行查询，把结果导入数据集。"
      },
      {
        t: "绑定字段与定位记录",
        d: "双击文字或条码对象，在「数据源」里选数据库字段。通过「数据库」菜单切换记录，或按 Ctrl+F 定位，再检查当前记录在标签上的显示。"
      },
      {
        t: "刷新数据与批量打印",
        d: "源数据变化后用「数据库 → 更新数据库」检查最新记录。正式打印前确认起始记录、打印数量、单签拷贝和当前记录选项。"
      },
    ]
  },
  {
    key: "installprinter",
    title: "连接打印机",
    intro: "按打印机型号和实际连接方式配置输出。",
    items: [
      {
        t: "使用系统打印机",
        d: "先在系统中安装打印机并确认能正常打印。然后在 MaxLabel 的打印机设置中选择系统驱动和对应队列，核对纸张尺寸。"
      },
      {
        t: "使用内置驱动",
        d: "在打印机设置里打开「安装打印机」，选择与设备匹配的型号、指令集和分辨率。安装后选中该打印机，并配置可用端口。设备所用的指令集以型号说明为准。"
      },
      {
        t: "核对端口",
        d: "图中以 TCP/IP 连接为例，请填写设备实际的 IP 或主机名和端口号。使用 USB 或串口时，从端口列表选择设备，接线后可刷新列表。串口还需与设备匹配波特率等参数。"
      },
      {
        t: "试打与定位问题",
        d: "放入实际使用的纸张并试打一张。系统队列可打印而指令直连无反应时，重点检查所选端口和指令集。输出错位时检查纸张尺寸、间距和设备校纸设置。"
      },
    ]
  },
  {
    key: "print",
    title: "预览与打印",
    intro: "正式打印前核对版式、数量和记录范围。",
    items: [
      {
        t: "打印预览",
        d: "从「文件 → 打印预览」检查对象边界与拼版。使用 MaxLabel 内置驱动的部分配置不提供预览，可以先试打一张，或在使用系统驱动时打开预览。"
      },
      {
        t: "打印数量与单签拷贝",
        d: "打印数量 × 单签拷贝 = 标签总张数。图中 2 个条目各打 2 份，共 4 张。使用数据库时也要核对起始记录。"
      },
      {
        t: "起始标签",
        d: "使用已打印过部分位置的多枚标签纸时，可在打印窗口设定起始标签，从剩余的第一个可用位置开始。"
      },
      {
        t: "测试打印与历史记录",
        d: "在打印窗口用「测试打印」验证标签。在「查看 → 打印历史记录」可查看已有记录与详情，并按可用权限导出。"
      },
    ]
  },
  {
    key: "cloud",
    title: "云空间与共享",
    intro: "从起始页访问个人、企业和平台资源。",
    items: [
      {
        t: "登录并切换空间",
        d: "从起始页登录账号，再选择「个人云空间」「企业云空间」或「平台共享空间」。可浏览的内容与账号权限有关，企业空间还需要有效的企业席位。"
      },
      {
        t: "上传与查找文件",
        d: "在对应分类上传模板、图片或数据文件。加号仅对有上传权限的账号显示。搜索框按文件名筛选当前分类。"
      },
      {
        t: "企业文件夹与成员权限",
        d: "在企业空间左侧选择文件夹，或打开「我的上传」。管理员可新建文件夹，有管理权限时可通过文件夹旁的「权限」设置成员访问、编辑和删除权限。"
      },
      {
        t: "打开或删除文件",
        d: "点击卡片打开模板或获取资源。具备删除权限的卡片右上角会显示红色 ×，点击后核对文件名并确认。平台共享空间供浏览和使用平台提供的资源。"
      },
    ]
  },
  {
    key: "export",
    title: "导出条码图片",
    intro: "将标签中的条码输出为图像，用于其他文件或系统。",
    items: [
      {
        t: "选择条码与导出入口",
        d: "在模板中选中需要导出的条码，按 Ctrl+E 打开「导出条码图片文件」。有多个条码时，在窗口中核对当前选择。"
      },
      {
        t: "核对导出设置",
        d: "选择目录和 PNG 或 BMP 格式，确认文件名和预览后点击「导出」。用于印刷时核对分辨率，导出后试扫条码。"
      },
    ]
  },
  {
    key: "shortcut",
    title: "键盘快捷键",
    intro: "编辑时常用的按键组合。",
    items: [
      {
        t: "模板与打印",
        d: "Ctrl+N 新建，Ctrl+O 打开，Ctrl+S 保存，Ctrl+W 关闭当前文档，Ctrl+P 打印，Ctrl+E 导出条码图片。"
      },
      {
        t: "画布编辑",
        d: "Ctrl+Z 撤销，Ctrl+Y 恢复，Ctrl+C 复制，Ctrl+V 粘贴，Delete 删除，Alt+Enter 打开属性。"
      },
      {
        t: "记录和帮助",
        d: "Ctrl+F 定位数据库记录。按 F1 或选择「帮助 → 帮助主题」打开本窗口。"
      },
    ]
  },
  {
    key: "faq",
    title: "常见问题",
    intro: "按现象查找处理步骤。",
    items: [
      {
        t: "没有找到打印机或打印无反应",
        d: "先检查电源、纸张和连线。在打印机设置里核对队列或端口。若使用 TCP，核对设备 IP 和端口号。若打印任务已经进入系统队列，查看队列是否暂停或脱机。"
      },
      {
        t: "标签偏移、跳纸或内容被裁切",
        d: "在「文件 → 标签格式设置」核对宽高、方向和间距。检查系统驱动纸张尺寸及打印机校纸，再通过试打一张确认位置。"
      },
      {
        t: "打印内容为空或记录错位",
        d: "用「数据库 → 定位记录」确认记录，检查对象绑定的数据集和字段是否正确。核对数据文件首行设置，以及打印窗口的起始记录和数量。"
      },
      {
        t: "无法编辑或上传",
        d: "检查起始页登录与订阅状态。企业空间还需有效席位和相应文件夹权限。权限有调整时可刷新列表，或请企业管理员核对授权。"
      },
      {
        t: "反馈问题",
        d: "通过「帮助 → 建议与反馈」获取联系方式。说明 MaxLabel 版本、操作步骤和报错文字。打印问题可附上打印机型号、端口类型及脱敏后的示例标签。"
      },
    ]
  },
]

const enUS: HelpSection[] = [
  {
    key: "start",
    title: "Quick start",
    intro: "Create a template, design a label and run a test print.",
    items: [
      {
        t: "Create a template and set the paper size",
        d: "Click New or press Ctrl+N. Match the label width and height to your stock. For sheets, also check rows, columns and gaps, then click Select."
      },
      {
        t: "Add text and a barcode",
        d: "Choose Text or Barcode in the toolbar and place an object on the canvas. Double-click it to open its properties and enter a fixed value on the Data Source tab. Choose a symbology for barcodes."
      },
      {
        t: "Save your template",
        d: "Press Ctrl+S. The first save prompts for a location and defaults to .msdx. Use Ctrl+O to open .msdx, compatible .json or legacy LabelShop .lsdx files. Check the layout and data bindings after importing a legacy template."
      },
      {
        t: "Choose a printer and test it",
        d: "Press Ctrl+P and verify the printer and port in Printer Properties. Run a test print to check orientation, placement and barcode readability before printing the full quantity."
      },
    ]
  },
  {
    key: "object",
    title: "Canvas and objects",
    intro: "Add, edit and arrange the elements on your label.",
    items: [
      {
        t: "Insert and select objects",
        d: "Pick an object type in the toolbar and place it on the canvas. Switch to Select to move or resize it. Drag from an empty area to select multiple objects."
      },
      {
        t: "Edit object properties",
        d: "Double-click an object or press Alt+Enter to open its properties. Depending on the object, use tabs such as Data Source, Barcode, Text, Appearance and General. On the Barcode tab, choose a symbology and bar height. Check that the symbology can encode your data."
      },
      {
        t: "Align, stack and group",
        d: "Select multiple objects and use Arrange to align, resize, distribute or group them. Move overlapping objects forward or backward to change their stacking order. Use layers to organize objects."
      },
      {
        t: "Change the label size",
        d: "Use File → Label Format Settings to adjust dimensions, orientation and sheet layout. Check that every object still fits inside the label."
      },
    ]
  },
  {
    key: "source",
    title: "Variable data",
    intro: "Use one template to produce different labels for different records.",
    items: [
      {
        t: "Fixed values and serial numbers",
        d: "Choose a constant on the object's Data Source tab for content repeated on every label. For serial numbers, set the starting value, increment and padding, then check the starting value and update options before printing."
      },
      {
        t: "Database fields",
        d: "Import a file through Database → Configure Database. Double-click the object and follow the figure to bind a field. Change records and check that the label updates."
      },
      {
        t: "Date, time and keyboard input",
        d: "Date and time sources use the selected format. For values such as batch numbers, configure a keyboard input prompt. Enter and verify the values in the dialog before continuing to print."
      },
      {
        t: "Script sources",
        d: "Use a script source when you need to calculate or combine values. Verify that scripts are enabled in system settings, then check the output with representative records."
      },
    ]
  },
  {
    key: "db",
    title: "Import and connect data",
    intro: "Read records from files or databases and bind them to label objects.",
    items: [
      {
        t: "Import Excel or text files",
        d: "Open Database → Configure Database and select an Excel, CSV or TXT file. For Excel, choose a sheet. If CSV or TXT text is garbled or columns are split incorrectly, adjust the encoding or delimiter."
      },
      {
        t: "Connect SQL or ODBC",
        d: "Choose a connection type offered in Database Settings, such as MySQL, SQLite or SQL Server. For ODBC, install a matching driver and configure its data source first. Test the connection, then import results from a table or query."
      },
      {
        t: "Bind fields and locate records",
        d: "Double-click a text or barcode object and choose a database field under Data Source. Step through records from the Database menu or use Ctrl+F to locate one and verify how it appears on the label."
      },
      {
        t: "Refresh data and batch print",
        d: "If the source changes, use Database → Update Database to refresh the records. Before printing, verify the start record, quantity, copies per label and current-record option."
      },
    ]
  },
  {
    key: "installprinter",
    title: "Connect a printer",
    intro: "Set up printing for the device model and its connection.",
    items: [
      {
        t: "Use a system printer",
        d: "Install the printer in the operating system and verify that it can print. In MaxLabel, select the system driver and matching queue, then check the paper size."
      },
      {
        t: "Use a built-in driver",
        d: "Open Install Printer from printer settings and choose the model, command language and resolution that match the device. Select the installed printer and configure an available port. Check the device manual for its command language."
      },
      {
        t: "Verify the port",
        d: "The figure shows a TCP/IP connection. Enter the actual printer IP address or hostname and port. For USB or serial, select the device from the port list and refresh it after connecting. Match serial settings such as the baud rate to the printer."
      },
      {
        t: "Test and troubleshoot",
        d: "Load the stock you intend to use and print one test label. If the system queue works but direct printing does not, check the selected port and command language. For alignment issues, check the stock dimensions, gaps and printer calibration."
      },
    ]
  },
  {
    key: "print",
    title: "Preview and print",
    intro: "Check the layout, quantities and record range before printing.",
    items: [
      {
        t: "Print preview",
        d: "Use File → Print Preview to check object boundaries and sheet layout. Some MaxLabel built-in driver configurations do not offer preview. Run a test print, or open preview when using a system driver."
      },
      {
        t: "Quantity and copies per label",
        d: "Multiply Print Count by Copies per Label. The example prints 2 entries twice for a total of 4 labels. For database printing, also check the start record."
      },
      {
        t: "Start label",
        d: "When reusing a partially printed sheet, set the start label to the first available position in the print dialog."
      },
      {
        t: "Test prints and print history",
        d: "Use Test Print in the print dialog to verify the label. Use View → Print History to review entries and details, and export when available to your account."
      },
    ]
  },
  {
    key: "cloud",
    title: "Cloud spaces and sharing",
    intro: "Access personal, enterprise and platform resources from the start page.",
    items: [
      {
        t: "Sign in and select a space",
        d: "Sign in from the start page and choose Personal Cloud Space, Enterprise Cloud Space or Platform Shared Space. Visible content depends on account permissions. Enterprise space requires an active seat."
      },
      {
        t: "Upload and find files",
        d: "Upload each file in its matching category. The plus tile appears when you have upload permission. Search filters filenames within the current category."
      },
      {
        t: "Enterprise folders and permissions",
        d: "Select a folder or My Uploads in the enterprise sidebar. Administrators can create folders. Use Permissions next to a folder you manage to set member access, editing and deletion rights."
      },
      {
        t: "Open or delete files",
        d: "Click a card to open a template or retrieve a resource. Cards you can delete show a red ×. Check the filename in the confirmation dialog. The platform space offers resources published by the platform."
      },
    ]
  },
  {
    key: "export",
    title: "Export barcode images",
    intro: "Save barcodes from your label as images for use in other files or systems.",
    items: [
      {
        t: "Choose a barcode and open export",
        d: "Select the barcode in the template and press Ctrl+E to open the barcode image export dialog. If the template contains several barcodes, verify the selection in the dialog."
      },
      {
        t: "Check export settings",
        d: "Choose a folder and PNG or BMP. Check the filename and preview, then click Export. For print use, verify the resolution and test that the exported barcode scans."
      },
    ]
  },
  {
    key: "shortcut",
    title: "Keyboard shortcuts",
    intro: "Common keys for working in the editor.",
    items: [
      {
        t: "Templates and printing",
        d: "Ctrl+N creates a template, Ctrl+O opens it, Ctrl+S saves it, Ctrl+W closes it, Ctrl+P prints and Ctrl+E exports barcode images."
      },
      {
        t: "Canvas editing",
        d: "Ctrl+Z undoes, Ctrl+Y redoes, Ctrl+C copies, Ctrl+V pastes, Delete removes the selection and Alt+Enter opens properties."
      },
      {
        t: "Records and help",
        d: "Ctrl+F locates a database record. Press F1 or choose Help → Help Topics to open this guide."
      },
    ]
  },
  {
    key: "faq",
    title: "Troubleshooting",
    intro: "Find steps for common problems.",
    items: [
      {
        t: "Printer missing or not responding",
        d: "Check power, stock and cabling first. Verify the queue or port in printer settings. For TCP, check the device address and port. If a job reached the system queue, check whether the queue is paused or offline."
      },
      {
        t: "Labels shift, skip or clip",
        d: "Verify width, height, orientation and gaps in File → Label Format Settings. Check the system driver's paper size and the printer calibration, then test one label."
      },
      {
        t: "Blank fields or wrong records",
        d: "Use Database → Locate Record to confirm the record. Verify the dataset and field bound to the object. Check the header setting in the data file and the start record and quantity in the print dialog."
      },
      {
        t: "Unable to edit or upload",
        d: "Check your sign-in and subscription status on the start page. Enterprise space also requires an active seat and folder permissions. Refresh the list after changes or ask your enterprise administrator to check your access."
      },
      {
        t: "Send feedback",
        d: "Use Help → Feedback for contact information. Include the MaxLabel version, steps and error message. For printing issues, include the printer model, port type and a sample label with sensitive information removed."
      },
    ]
  },
]

export const HELP_SECTIONS: Record<Language, HelpSection[]> = {
  'zh-CN': zhCN,
  'en-US': enUS
}

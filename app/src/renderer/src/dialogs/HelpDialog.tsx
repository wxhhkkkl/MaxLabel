import { useState } from 'react'
import Modal from './Modal'

interface HelpSection {
  key: string
  title: string
  intro: string
  items: Array<{ t: string; d: string }>
}

const SECTIONS: HelpSection[] = [
  {
    key: 'start',
    title: '快速开始',
    intro: '创建标签模板并完成第一次打印的最小流程。',
    items: [
      { t: '新建模板', d: '点击工具栏"新建标签模版"或按 Ctrl+N，选择标签格式（宽度/高度，单位毫米或英寸），确定后进入编辑界面。' },
      { t: '打开模板', d: '"打开标签模版"或 Ctrl+O 选择本地 .json 模板文件；开始页的"最近打开"与"模板库"可直接双击打开。' },
      { t: '保存模板', d: 'Ctrl+S 保存为 .json 文件（含对象、数据源、打印机设置、拼版布局）。也可保存到模板库，模板库卡片显示缩略图预览。' },
      { t: '标签格式设置', d: '工具栏"标签格式设置"按钮或快捷键打开对话框：可设标签宽高、方向（旋转 90/180/270）、单位与拼版行列、行/列间隔、外观形状、打印顺序（先行后列/先列后行）。' },
      { t: '打印', d: '底部打印面板：选择打印机（Windows 驱动或指令直连）、打印数量、单签拷贝、起始标签，然后"打印预览"或"打印"。' }
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
      { t: '指令直连', d: 'TSPL/ZPL/CPCL 等指令集直发标签打印机，支持文件/TCP/COM/蓝牙（SPP 虚拟串口）；USB 请安装驱动或映射为 COM 端口。国产主流标签机（佳博、汉印、芯烨等）兼容；专业机型效果最佳。' },
      { t: '打印数量 × 单签拷贝', d: '打印数量控制可变数据推进的张数；单签拷贝为同一张的重复份数。实际输出 = 打印数量 × 单签拷贝。' },
      { t: '起始标签', d: '页式机从第 N 张标签开始打印。' },
      { t: '测试打印', d: '打印 1 张，不写日志、不推进序列号，用于验证版式。' },
      { t: '指令打印到文件', d: '打印机端口选择"打印到文件"时，将生成的指令保存为 .prn/.txt 文件，供设备调试或批量下发。' },
      { t: '打印历史', d: '每次打印记录日志（含测试标记），可在"打印历史记录"对话框查看详情、导出 CSV、清空。' }
    ]
  },
  {
    key: 'shortcut',
    title: '快捷键',
    intro: '常用快捷键一览。',
    items: [
      { t: '文件', d: 'Ctrl+N 新建、Ctrl+O 打开、Ctrl+S 保存、Ctrl+W 关闭、Ctrl+E 导出条码图片、Ctrl+P 打印。' },
      { t: '编辑', d: 'Ctrl+Z 撤销、Ctrl+Y 重做、Ctrl+X 剪切、Ctrl+C 复制、Ctrl+V 粘贴（偏移 1mm）、Delete 删除、Ctrl+A 全选、Alt+Enter 属性、Ctrl+G 组合、Ctrl+U 取消组合、Ctrl+L 位置锁定。' },
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

export default function HelpDialog({ onClose }: { onClose: () => void }) {
  const [key, setKey] = useState(SECTIONS[0].key)
  const sec = SECTIONS.find((s) => s.key === key) ?? SECTIONS[0]
  return (
    <Modal title="帮助主题" onClose={onClose} width={680}>
      <div style={{ display: 'flex', gap: 12, minHeight: 380 }}>
        <div style={{ width: 150, flexShrink: 0, borderRight: '1px solid #ECEBE6', paddingRight: 8 }}>
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setKey(s.key)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                marginBottom: 4,
                borderRadius: 6,
                border: 'none',
                background: key === s.key ? '#E8F1F6' : 'transparent',
                color: key === s.key ? '#2E6E93' : '#1A1B1C',
                fontWeight: key === s.key ? 600 : 400,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              {s.title}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0, maxHeight: 380, overflow: 'auto' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1B1C', marginBottom: 4 }}>{sec.title}</div>
          <div style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 12 }}>{sec.intro}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sec.items.map((it, i) => (
              <div key={i}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1B1C', marginBottom: 2 }}>{it.t}</div>
                <div style={{ fontSize: 12.5, color: '#4B5563', lineHeight: 1.6 }}>{it.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

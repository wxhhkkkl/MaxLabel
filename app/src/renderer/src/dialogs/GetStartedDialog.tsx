import { useState } from 'react'
import Modal from './Modal'

interface Props {
  onClose: () => void
  onNew: () => void
  onPrinter: () => void
  onEdit: () => void
  onPreview: () => void
}

/**
 * 章节结构与文案出处：帮助 `getstart_main.html`（本章学习内容：了解标签打印的概念、
 * 了解条码打印机、编辑并打印第一个标签、可变数据打印的概念、签赋LabelShop 的版本信息，
 * 以及"需要激活才可以正常使用，也可以在未激活的状态下体验"）、`getstart_label.html`、
 * `getstart_printer.html`、`getstart_summary.html`、`getstart_variable.html`、`getstart_version.html`。
 * `action` 为空的条目是纯概念页，末步按钮为"完成"。
 */
const STEPS = [
  {
    key: 'concept',
    title: '标签打印的概念',
    intro: '标签按行和列布局在页面上，编辑好一个标签即可自动排列打印。',
    detail: '签赋LabelShop是一款用于标签编辑打印的软件，可以使用它设置标签格式、编辑标签模板，并且在输出设备上打印标签。标签打印与普通打印不同的是：标签是按行和列布局在页面上的，只需编辑好一个标签的格式，打印软件自动在页面上排列标签并进行打印。因此需要预先设计好标签的格式——单个标签的宽度、高度，标签的行数、列数、间隔等参数；然后针对一个标签进行模板设计。打印时设置好需要输出的标签数量，软件会自动按预先设计好的格式将标签打印在整个页面上。支持每个标签上的文字和条码内容变化（图片内容也可以不同），但每个标签上的布局必须是一致的。'
  },
  {
    key: 'printer',
    title: '了解条码打印机',
    intro: '打印机分平张页式与卷筒式标签打印机两类，条码打印机可用指令集直接驱动。',
    detail: '签赋LabelShop将打印机分为两类：平张页式打印机（打印单张纸，如常见的激光、喷墨打印机）和卷筒式标签打印机（打印连续的卷筒式标签纸，一般特指专用的条码标签打印机），软件会通过驱动程序识别这两类打印机并显示正确的标签格式。对条码打印机可用指令集直接驱动实现高效输出（本软件当前实现 TSPL / ZPL / CPCL 三套指令集），并集成有内置驱动，可在不安装 Windows 驱动的情况下直接向端口发送指令。也可选择图形（驱动）输出方式。目标打印机及其参数（打印速度、打印黑度等）会随标签模板保存，下次打印时沿用。'
  },
  {
    key: 'new',
    title: '新建标签',
    intro: '选择标签格式（宽度 / 高度 / 方向 / 拼版），开始设计。',
    detail: '点击"新建标签模版"（或 Ctrl+N）打开标签格式选择对话框。选定后进入编辑界面，画布外部为青色工作区，带毫米/英寸标尺。标签格式设置可随时修改（工具栏"标签格式设置"按钮）。'
  },
  {
    key: 'object',
    title: '添加对象与数据',
    intro: '创建文字、条码、图片、表格等对象，并绑定数据源。',
    detail: '在工具栏选择对象工具（条码/文字/线条/斜线/矩形/图片/数据/表格），在画布上点击或拖拽创建。条码支持 18 种码制（EAN-13/8、UPC-A/E、Code39、Code128、Code93、ITF14、Interleaved 25、Code 25、Matrix 25、Codabar、中国邮政码、GS1 DataBar、QR、DataMatrix、PDF417、汉信码等），并支持各码制专属选项。数据源分七类：常量、序列号、数据库、日期、时间、键盘输入、脚本。双击对象打开属性对话框可设置数据源、子串、格式化、长度限制等高级处理。'
  },
  {
    key: 'variable',
    title: '可变数据打印的概念',
    intro: '序列号、数据库、日期时间、键盘输入与脚本五种变量来源。',
    detail: '每个标签可以打印不同的数据。变量模式包括顺序变号（在签赋LabelShop中称为序列号）、导入保存在文本文件、电子表格或 ACCESS / SQL Server / ORACLE 等数据库中的内容、自动生成日期和时间、打印时提示用户输入相应的数据，以及使用 VB Script 编写代码对数据进行高级格式化处理。序列号标签的做法是：排入文字后双击，在"数据源"属性中修改为序列号类型，并将数据修改为起始号码即可，可通过"高级选项"修改序列号的设置。还可以对数据进行截短或者填充到指定长度的处理，也可以将多个数据连接在一起处理，或将多个文字、条码对象的内容连接起来统一变化，以提高打印效率、降低差错率。'
  },
  {
    key: 'print',
    title: '打印标签',
    intro: '设置打印数量与拷贝数，预览后打印。',
    detail: '在打印面板设置打印数量、单签拷贝数、起始标签后，可先"打印预览"检查版面，再"打印"输出。打印历史记录在"打印"菜单中可查看；测试打印不写入日志、不推进序列号。数据库打印支持逐记录输出与打印时数据查重。'
  },
  {
    key: 'version',
    title: '版本与激活',
    intro: '标准版 / 专业版 / 企业版三个版本；未激活也可体验功能。',
    detail: '签赋LabelShop提供三个版本：标准版面向需要基本标签编辑打印功能的用户，可满足大多数标签编辑打印需求；专业版为需要实现高效率打印以及需要二次开发等功能的用户而设计；企业版适用于模板管理等企业级管理需求的用户。各个版本均需激活才可使用；在激活之前也可以体验软件功能，用户可以在首次启动以及后续从"帮助"中进入体验入口。未登录或未激活时，云模板保存与分享等联网功能不可用。'
  }
]

export default function GetStartedDialog({ onClose, onNew, onPrinter, onEdit, onPreview }: Props) {
  const [step, setStep] = useState(0)
  const s = STEPS[step]
  const actions: Record<string, () => void> = {
    new: () => {
      onClose()
      onNew()
    },
    printer: () => {
      onClose()
      onPrinter()
    },
    object: () => {
      onClose()
      onEdit()
    },
    print: () => {
      onClose()
      onPreview()
    }
  }

  return (
    <Modal title="新手入门" onClose={onClose} width={640} testId="get-started-dialog">
      <div style={{ display: 'flex', gap: 14, minHeight: 320 }}>
        <div style={{ width: 140, flexShrink: 0, borderRight: '1px solid #ECEBE6', paddingRight: 8 }}>
          {STEPS.map((st, i) => (
            <button
              key={st.key}
              type="button"
              data-testid={`get-started-step-${st.key}`}
              onClick={() => setStep(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                marginBottom: 4,
                borderRadius: 6,
                border: 'none',
                background: step === i ? '#E8F1F6' : 'transparent',
                color: step === i ? '#2E6E93' : '#1A1B1C',
                fontWeight: step === i ? 600 : 400,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: step === i ? '#2E6E93' : '#D8D8D2',
                  color: '#fff',
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {i + 1}
              </span>
              {st.title}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div data-testid="get-started-title" style={{ fontSize: 16, fontWeight: 600, color: '#1A1B1C' }}>{s.title}</div>
          <div data-testid="get-started-intro" style={{ fontSize: 13, color: '#2E6E93', fontWeight: 500 }}>{s.intro}</div>
          <div data-testid="get-started-detail" style={{ fontSize: 12.5, color: '#4A4B4C', lineHeight: 1.7 }}>{s.detail}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8 }}>
            <button type="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #D8D8D2', background: '#fff', color: '#1A1B1C', fontSize: 13, cursor: step === 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              上一步
            </button>
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => setStep(step + 1)} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#2E6E93', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                下一步
              </button>
            ) : (
              <button
                type="button"
                data-testid="get-started-finish"
                onClick={actions[s.key] ?? onClose}
                style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#2E6E93', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {actions[s.key] ? '开始操作' : '完成'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

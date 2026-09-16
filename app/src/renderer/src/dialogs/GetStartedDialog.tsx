import { useState } from 'react'
import Modal from './Modal'

interface Props {
  onClose: () => void
  onNew: () => void
  onPrinter: () => void
  onEdit: () => void
  onPreview: () => void
}

const STEPS = [
  {
    key: 'new',
    title: '新建标签',
    intro: '选择标签格式（宽度 / 高度 / 方向 / 拼版），开始设计。',
    detail: '点击"新建标签模版"（或 Ctrl+N）打开标签格式选择对话框。选定后进入编辑界面，画布外部为青色工作区，带毫米/英寸标尺。标签格式设置可随时修改（工具栏"标签格式设置"按钮）。'
  },
  {
    key: 'printer',
    title: '设置打印机',
    intro: '选择打印机与打印参数，是标签正确输出的关键。',
    detail: '底部打印面板可选择打印机：Windows 驱动（走系统打印对话框）或指令直连（TSPL/ZPL/CPCL 等，直接向端口发送指令，无需装驱动）。指令直连可配置速度、浓度、热敏/热转印、标签类型（连续纸/间隔定位/标记定位）、顶部偏移、介质处理（撕纸/剥离/切纸）、出纸回退、分辨率（203/300/600dpi）。打印机设置会随标签模板保存。'
  },
  {
    key: 'object',
    title: '添加对象与数据',
    intro: '创建文字、条码、图片、表格等对象，并绑定数据源。',
    detail: '在工具栏选择对象工具（条码/文字/线条/斜线/矩形/图片/数据/表格），在画布上点击或拖拽创建。条码支持 18 种码制（EAN-13/8、UPC-A/E、Code39、Code128、Code93、ITF14、Interleaved 25、Code 25、Matrix 25、Codabar、中国邮政码、GS1 DataBar、QR、DataMatrix、PDF417、汉信码等），并支持各码制专属选项。数据源分七类：常量、序列号、数据库、日期、时间、键盘输入、脚本。双击对象打开属性对话框可设置数据源、子串、格式化、长度限制等高级处理。'
  },
  {
    key: 'print',
    title: '打印标签',
    intro: '设置打印数量与拷贝数，预览后打印。',
    detail: '在打印面板设置打印数量、单签拷贝数、起始标签后，可先"打印预览"检查版面，再"打印"输出。打印历史记录在"打印"菜单中可查看；测试打印不写入日志、不推进序列号。数据库打印支持逐记录输出与打印时数据查重。'
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
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1A1B1C' }}>{s.title}</div>
          <div style={{ fontSize: 13, color: '#2E6E93', fontWeight: 500 }}>{s.intro}</div>
          <div style={{ fontSize: 12.5, color: '#4A4B4C', lineHeight: 1.7 }}>{s.detail}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8 }}>
            <button type="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #D8D8D2', background: '#fff', color: '#1A1B1C', fontSize: 13, cursor: step === 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              上一步
            </button>
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => setStep(step + 1)} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#2E6E93', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                下一步
              </button>
            ) : (
              <button type="button" onClick={actions[s.key]} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#2E6E93', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                开始操作
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

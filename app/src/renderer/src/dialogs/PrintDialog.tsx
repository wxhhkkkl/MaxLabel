import { useState } from 'react'
import PrintAdvancedDialog from './PrintAdvancedDialog'

export interface PrintAdvancedOptions {
  autoCount: boolean
  copyField: boolean
  copyFieldName: string
  firstCopyAsk: boolean
  dupcheck: boolean
  currentOnly: boolean
  updateSerial: boolean
  rotate180: boolean
  printBorder: boolean
  trackStartLabel: boolean
  headerFooter: boolean
  headerFooterTemplate: string
  headerFooterOffsetMm: number
  cropMarks: boolean
  cropMarkOffsetMm: number
}

type Props = {
  title: string
  printerLabel: string
  printerPosition: string
  /** Command/file output cannot select a physical sheet start slot. */
  commandOutput: boolean
  count: number
  setCount: (value: number) => void
  copies: number
  setCopies: (value: number) => void
  startRecord: number
  setStartRecord: (value: number) => void
  startLabel: number
  setStartLabel: (value: number) => void
  pageLabelCount?: number
  advanced: PrintAdvancedOptions
  setAdvanced: (patch: Partial<PrintAdvancedOptions>) => void
  onPrinterProperties: () => void
  onPreview: () => void
  /** 文档绑定「签赋LabelShop 打印机」（内置驱动）时禁用预览（真机 probe-19/20）。 */
  previewBlocked?: boolean
  onTestPrint: () => void
  onHelp: () => void
  onClose: () => void
  onPrint: (count?: number) => void
}

function CheckOption({ testId, checked, disabled = false, onChange, children }: { testId?: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 30, fontSize: 13, color: disabled ? '#9CA3AF' : '#1A1B1C', cursor: disabled ? 'default' : 'pointer' }}>
      <input data-testid={testId} type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} style={{ width: 16, height: 16, margin: 0 }} />
      <span>{children}</span>
    </label>
  )
}

const sectionStyle: React.CSSProperties = { border: '1px solid #D8D6CF', padding: '10px 14px 14px' }
const legendStyle: React.CSSProperties = { marginTop: -22, marginBottom: 12, width: 'fit-content', padding: '0 6px', background: '#F7F7F7', color: '#6B7280', fontSize: 13 }
const inputStyle: React.CSSProperties = { width: 76, padding: '6px 8px', border: '1px solid #C8C6BF', fontSize: 13, boxSizing: 'border-box' }

export default function PrintDialog(props: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const setNumber = (value: string, fallback: number, setter: (next: number) => void) => {
    const parsed = Number.parseInt(value, 10)
    setter(Number.isFinite(parsed) ? Math.min(99999, Math.max(1, parsed)) : fallback)
  }
  const labelCount = Math.max(1, props.pageLabelCount ?? 8)

  return (
    <>
      <div data-testid="print-dialog" role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.24)', display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: 14, boxSizing: 'border-box' }} onClick={props.onClose}>
        <div style={{ width: 'min(1080px, 96vw)', background: '#F7F7F7', border: '1px solid #D5D4CD', boxShadow: '0 10px 36px rgba(0,0,0,0.24)', display: 'flex', flexDirection: 'column', color: '#1A1B1C' }} onClick={(event) => event.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #D8D6CF', fontSize: 15, color: '#6B7280' }}>
            <span>打印</span>
            <button type="button" aria-label="关闭打印对话框" onClick={props.onClose} style={{ border: 'none', background: 'transparent', color: '#7B7E85', fontSize: 22, lineHeight: 1, cursor: 'pointer' }}>×</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18, padding: 18, overflow: 'auto', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <section data-testid="print-dialog-group-printer" style={sectionStyle}>
                <div style={legendStyle}>打印机</div>
                <div style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr) 150px', rowGap: 12, alignItems: 'center', fontSize: 13 }}>
                  <span>名称：</span><span data-testid="print-dialog-printer" style={{ fontWeight: 600 }}>{props.printerLabel}</span><span />
                  <span>位置：</span><span data-testid="print-dialog-printer-position" style={{ color: '#4B5563' }}>{props.printerPosition}</span>
                  <button type="button" data-testid="print-dialog-printer-properties" onClick={props.onPrinterProperties} style={{ padding: '8px 10px', border: '1px solid #C8C6BF', background: '#fff', borderRadius: 5, fontSize: 13, cursor: 'pointer' }}>打印机属性</button>
                </div>
              </section>

              <section data-testid="print-dialog-group-range" style={sectionStyle}>
                <div style={legendStyle}>打印范围</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center', fontSize: 13 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    打印数量
                    <input data-testid="print-dialog-count" type="number" min={1} max={99999} value={props.count} disabled={props.advanced.currentOnly} onChange={(event) => setNumber(event.target.value, props.count, props.setCount)} style={inputStyle} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    单签拷贝
                    <input data-testid="print-dialog-copies" type="number" min={1} max={99999} value={props.copies} onChange={(event) => setNumber(event.target.value, props.copies, props.setCopies)} style={inputStyle} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    启始记录
                    <input data-testid="print-dialog-start-record" aria-label="启始记录" type="number" min={1} max={99999} value={props.startRecord} onChange={(event) => setNumber(event.target.value, props.startRecord, props.setStartRecord)} style={inputStyle} />
                  </label>
                </div>
                <div style={{ marginTop: 10 }}>
                  <CheckOption testId="print-option-current-only" checked={props.advanced.currentOnly} onChange={(value) => props.setAdvanced({ currentOnly: value })}>只打印数据表中当前记录行的数据</CheckOption>
                </div>
              </section>

              <section data-testid="print-dialog-group-settings" style={sectionStyle}>
                <div style={legendStyle}>设置</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 20, rowGap: 4 }}>
                  <CheckOption testId="print-option-update-vars" checked={props.advanced.updateSerial} onChange={(value) => props.setAdvanced({ updateSerial: value })}>打印后更新变量数据</CheckOption>
                  <CheckOption testId="print-option-rotate180" checked={props.advanced.rotate180} onChange={(value) => props.setAdvanced({ rotate180: value })}>旋转180度输出</CheckOption>
                  <CheckOption testId="print-option-border" checked={props.advanced.printBorder} disabled onChange={() => undefined}>打印标签边框</CheckOption>
                  <button type="button" data-testid="print-dialog-advanced" onClick={() => setAdvancedOpen(true)} style={{ justifySelf: 'end', minWidth: 150, padding: '8px 16px', border: '1px solid #C8C6BF', background: '#fff', borderRadius: 5, fontSize: 13, cursor: 'pointer' }}>高级选项</button>
                </div>
              </section>
            </div>

            <aside data-testid="print-dialog-start-labels" data-command-output={props.commandOutput ? 'true' : 'false'} style={{ border: '1px solid #D8D6CF', padding: 14, minHeight: 300 }}>
              <div style={{ color: '#6B7280', fontSize: 13, marginBottom: 12 }}>
                选取起始标签
                <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>选择起始标签</span>
              </div>
              {props.commandOutput ? (
                <div data-testid="print-dialog-start-disabled" style={{ minHeight: 108, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E1E0DB', color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: 12, boxSizing: 'border-box' }}>
                  命令输出方式不支持选择起始标签
                </div>
              ) : (
                <div data-testid="print-dialog-start-preview" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, border: '1px solid #1A1B1C', padding: 5 }}>
                  {Array.from({ length: labelCount }, (_, index) => {
                    const position = index + 1
                    // 帮助 print_dlg_main.html：「被指定为起始标签之前的标签都将变成灰色，
                    // 而之后的所有标签将重新排号，指定的起始标签排号为 1」。
                    const used = position < props.startLabel
                    const selected = position === props.startLabel
                    const displayNumber = used ? position : position - props.startLabel + 1
                    return <button key={index} type="button" disabled={used} data-testid={`print-start-label-${position}`} aria-label={`起始标签${position}`} onClick={() => props.setStartLabel(position)} style={{ height: 50, border: '1px solid #1A1B1C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, background: used ? '#F2F1EC' : selected ? '#E4EFF7' : '#fff', cursor: used ? 'default' : 'pointer', color: used ? '#B0AFA9' : '#1A1B1C' }}>{displayNumber}</button>
                  })}
                </div>
              )}
              <CheckOption testId="print-option-track-start" checked={props.advanced.trackStartLabel} disabled={props.commandOutput} onChange={(value) => props.setAdvanced({ trackStartLabel: value })}>自动跟踪起始标签位置</CheckOption>
            </aside>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '10px 18px 14px', borderTop: '1px solid #D8D6CF' }}>
            <button type="button" data-testid="print-dialog-preview" onClick={props.onPreview} disabled={props.previewBlocked} title={props.previewBlocked ? 'LabelShop 打印机内置驱动不支持打印预览' : undefined} style={{ minWidth: 100, padding: '9px 16px', border: '1px solid #C8C6BF', background: '#fff', fontSize: 13, cursor: props.previewBlocked ? 'not-allowed' : 'pointer', color: props.previewBlocked ? '#B0AFA9' : '#1A1B1C' }}>预览</button>
            <button type="button" data-testid="print-dialog-test-print" onClick={props.onTestPrint} style={{ minWidth: 100, padding: '9px 16px', border: '1px solid #C8C6BF', background: '#fff', fontSize: 13, cursor: 'pointer' }}>测试打印</button>
            <button type="button" onClick={props.onClose} style={{ minWidth: 100, padding: '9px 16px', border: '1px solid #C8C6BF', background: '#fff', fontSize: 13, cursor: 'pointer' }}>取消</button>
            <button type="button" data-testid="print-dialog-submit" onClick={() => props.onPrint(props.count)} style={{ minWidth: 100, padding: '9px 16px', border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>打印</button>
            <button type="button" data-testid="print-dialog-help" onClick={props.onHelp} style={{ minWidth: 100, padding: '9px 16px', border: '1px solid #C8C6BF', background: '#fff', fontSize: 13, cursor: 'pointer' }}>帮助</button>
          </div>
        </div>
      </div>
      {advancedOpen && <PrintAdvancedDialog advanced={props.advanced} onSave={props.setAdvanced} onClose={() => setAdvancedOpen(false)} onHelp={props.onHelp} />}
    </>
  )
}

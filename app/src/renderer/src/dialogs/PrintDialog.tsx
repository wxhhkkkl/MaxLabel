export interface PrintAdvancedOptions {
  autoCount: boolean
  copyField: boolean
  copyFieldName: string
  firstCopyAsk: boolean
  dupcheck: boolean
  currentOnly: boolean
  updateSerial: boolean
}

type Props = {
  title: string
  printerLabel: string
  count: number
  setCount: (value: number) => void
  copies: number
  setCopies: (value: number) => void
  /** 数据库打印的起始记录（从 1 开始）；与拼版的起始标签位置分开。 */
  startRecord: number
  setStartRecord: (value: number) => void
  startLabel: number
  setStartLabel: (value: number) => void
  advanced: PrintAdvancedOptions
  setAdvanced: (patch: Partial<PrintAdvancedOptions>) => void
  onClose: () => void
  onPrint: () => void
}

function CheckOption({ testId, checked, onChange, children }: { testId: string; checked: boolean; onChange: (value: boolean) => void; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 30, fontSize: 13, color: '#1A1B1C', cursor: 'pointer' }}>
      <input data-testid={testId} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} style={{ width: 16, height: 16, margin: 0 }} />
      <span>{children}</span>
    </label>
  )
}

export default function PrintDialog(props: Props) {
  const setNumber = (value: string, fallback: number, setter: (next: number) => void) => {
    const parsed = Number.parseInt(value, 10)
    setter(Number.isFinite(parsed) ? Math.max(1, parsed) : fallback)
  }

  return (
    <div data-testid="print-dialog" style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.24)', display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: 14, boxSizing: 'border-box' }} onClick={props.onClose}>
      <div style={{ width: 'min(980px, 96vw)', background: '#F7F7F7', border: '1px solid #D5D4CD', boxShadow: '0 10px 36px rgba(0,0,0,0.24)', display: 'flex', flexDirection: 'column', color: '#1A1B1C' }} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #D8D6CF', fontSize: 15, color: '#6B7280' }}>
          <span>打印</span>
          <button type="button" aria-label="关闭打印对话框" onClick={props.onClose} style={{ border: 'none', background: 'transparent', color: '#7B7E85', fontSize: 22, lineHeight: 1, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18, padding: 18, overflow: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section style={{ border: '1px solid #D8D6CF', padding: '10px 14px 14px' }}>
              <div style={{ marginTop: -22, marginBottom: 12, width: 'fit-content', padding: '0 6px', background: '#F7F7F7', color: '#6B7280', fontSize: 13 }}>打印机</div>
              <div style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr)', rowGap: 12, alignItems: 'center', fontSize: 13 }}>
                <span>名称：</span><span data-testid="print-dialog-printer" style={{ fontWeight: 600 }}>{props.printerLabel}</span>
                <span>模板：</span><span>{props.title}</span>
              </div>
            </section>

            <section style={{ border: '1px solid #D8D6CF', padding: '10px 14px 14px' }}>
              <div style={{ marginTop: -22, marginBottom: 12, width: 'fit-content', padding: '0 6px', background: '#F7F7F7', color: '#6B7280', fontSize: 13 }}>打印范围</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center', fontSize: 13 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  打印数量
                  <input data-testid="print-dialog-count" type="number" min={1} max={99999} value={props.count} onChange={(event) => setNumber(event.target.value, props.count, props.setCount)} style={{ width: 76, padding: '6px 8px', border: '1px solid #C8C6BF', fontSize: 13, boxSizing: 'border-box' }} />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  单签拷贝
                  <input data-testid="print-dialog-copies" type="number" min={1} max={99999} value={props.copies} onChange={(event) => setNumber(event.target.value, props.copies, props.setCopies)} style={{ width: 76, padding: '6px 8px', border: '1px solid #C8C6BF', fontSize: 13, boxSizing: 'border-box' }} />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  启始记录
                  <input data-testid="print-dialog-start-record" aria-label="起始记录" type="number" min={1} max={99999} value={props.startRecord} onChange={(event) => setNumber(event.target.value, props.startRecord, props.setStartRecord)} style={{ width: 76, padding: '6px 8px', border: '1px solid #C8C6BF', fontSize: 13, boxSizing: 'border-box' }} />
                </label>
              </div>
            </section>

            <section data-testid="print-dialog-options" style={{ border: '1px solid #D8D6CF', padding: '10px 14px 14px' }}>
              <div style={{ marginTop: -22, marginBottom: 10, width: 'fit-content', padding: '0 6px', background: '#F7F7F7', color: '#6B7280', fontSize: 13 }}>数据库打印高级选项</div>
              <CheckOption testId="print-option-auto-count" checked={props.advanced.autoCount} onChange={(value) => props.setAdvanced({ autoCount: value })}>打印时自动设置数据库记录数量</CheckOption>
              <CheckOption testId="print-option-copy-field" checked={props.advanced.copyField} onChange={(value) => props.setAdvanced({ copyField: value })}>拷贝数量从数据库字段引入</CheckOption>
              {props.advanced.copyField && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 4px 24px', fontSize: 12.5, color: '#6B7280' }}>
                  字段名称
                  <input data-testid="print-option-copy-field-name" value={props.advanced.copyFieldName} onChange={(event) => props.setAdvanced({ copyFieldName: event.target.value })} placeholder="如 qty" style={{ flex: 1, minWidth: 120, padding: '5px 8px', border: '1px solid #C8C6BF', fontSize: 12.5 }} />
                </label>
              )}
              <CheckOption testId="print-option-first-copy" checked={props.advanced.firstCopyAsk} onChange={(value) => props.setAdvanced({ firstCopyAsk: value })}>允许打印时输入第一个标签的拷贝数量</CheckOption>
              <CheckOption testId="print-option-dupcheck" checked={props.advanced.dupcheck} onChange={(value) => props.setAdvanced({ dupcheck: value })}>打印时数据查重（重复记录跳过）</CheckOption>
              <CheckOption testId="print-option-current-only" checked={props.advanced.currentOnly} onChange={(value) => props.setAdvanced({ currentOnly: value })}>仅打印当前数据记录</CheckOption>
              <CheckOption testId="print-option-update-serial" checked={props.advanced.updateSerial} onChange={(value) => props.setAdvanced({ updateSerial: value })}>打印拷贝序列号/数量</CheckOption>
            </section>
          </div>

          <aside style={{ border: '1px solid #D8D6CF', padding: 14, minHeight: 300 }}>
            <div style={{ color: '#6B7280', fontSize: 13, marginBottom: 12 }}>选取起始标签</div>
            <div data-testid="print-dialog-start-preview" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, border: '1px solid #1A1B1C', padding: 5 }}>
              {Array.from({ length: 8 }, (_, index) => <div key={index} style={{ height: 50, border: '1px solid #1A1B1C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, background: index + 1 === props.startLabel ? '#E4EFF7' : '#fff' }}>{index + 1}</div>)}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12.5 }}>
              <input type="checkbox" defaultChecked={false} style={{ width: 16, height: 16 }} />
              自动跟踪起始标签位置
            </label>
          </aside>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '10px 18px 14px', borderTop: '1px solid #D8D6CF' }}>
          <button type="button" onClick={props.onClose} style={{ minWidth: 100, padding: '9px 16px', border: '1px solid #C8C6BF', background: '#fff', fontSize: 13, cursor: 'pointer' }}>取消</button>
          <button type="button" data-testid="print-dialog-submit" onClick={props.onPrint} style={{ minWidth: 110, padding: '9px 16px', border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>打印</button>
        </div>
      </div>
    </div>
  )
}

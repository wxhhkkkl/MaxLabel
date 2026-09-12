import { useState } from 'react'
import Modal, { FormField } from './Modal'

const btnStyle: React.CSSProperties = { padding: '7px 22px', borderRadius: 7, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }
const ghostStyle: React.CSSProperties = { padding: '7px 18px', borderRadius: 7, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }

/** 定位记录（数据库 → 定位记录，Ctrl+F）：按记录号定位 + 按字段内容查找 */
export function LocateRecordDialog({
  total,
  dsCols = [],
  dsRows = [],
  onLocate,
  onClose
}: {
  total: number
  dsCols?: string[]
  dsRows?: string[][]
  onLocate: (idx: number) => void
  onClose: () => void
}) {
  const [n, setN] = useState('1')
  const [mode, setMode] = useState<'num' | 'field'>('num')
  const [direction, setDirection] = useState<'next' | 'prev'>('next')
  const [cycle, setCycle] = useState(true)
  const [field, setField] = useState(dsCols[0] ?? '')
  const [content, setContent] = useState('')
  const [fuzzy, setFuzzy] = useState(true)
  const [found, setFound] = useState<null | string>(null)

  const go = () => {
    if (mode === 'num') {
      const v = parseInt(n, 10)
      if (isNaN(v) || v < 1) { setFound('请输入有效的记录号'); return }
      onLocate(Math.min(v - 1, Math.max(0, total - 1)))
      onClose()
      return
    }
    // 按字段内容查找
    const colIdx = dsCols.indexOf(field)
    if (colIdx < 0 || !content) { setFound('请选择索引字段并输入查找内容'); return }
    const start = direction === 'next' ? 0 : total - 1
    const end = direction === 'next' ? total - 1 : 0
    const step = direction === 'next' ? 1 : -1
    for (let i = start; direction === 'next' ? i <= end : i >= end; i += step) {
      const cell = dsRows[i]?.[colIdx] ?? ''
      const hit = fuzzy ? cell.toLowerCase().includes(content.toLowerCase()) : cell === content
      if (hit) {
        onLocate(i)
        onClose()
        return
      }
      if (!cycle && ((direction === 'next' && i === end) || (direction === 'prev' && i === end))) break
    }
    if (cycle && total > 0) {
      // 循环查找第二遍
      const s2 = direction === 'next' ? 0 : total - 1
      const e2 = direction === 'next' ? total - 1 : 0
      const st2 = direction === 'next' ? 1 : -1
      for (let i = s2; direction === 'next' ? i <= e2 : i >= e2; i += st2) {
        const cell = dsRows[i]?.[colIdx] ?? ''
        const hit = fuzzy ? cell.toLowerCase().includes(content.toLowerCase()) : cell === content
        if (hit) { onLocate(i); onClose(); return }
      }
    }
    setFound('未找到匹配的记录')
  }

  const select: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff' }
  return (
    <Modal title="定位记录" onClose={onClose} width={400} footer={<>
      <button type="button" style={ghostStyle} onClick={onClose}>取消</button>
      <button type="button" style={btnStyle} onClick={go}>定位</button>
    </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#1A1B1C' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <input type="radio" checked={mode === 'num'} onChange={() => setMode('num')} style={{ width: 14, height: 14 }} /> 指定记录号
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <input type="radio" checked={mode === 'field'} onChange={() => setMode('field')} style={{ width: 14, height: 14 }} /> 按字段内容查找
          </label>
        </div>
        {mode === 'num' ? (
          <FormField label={`记录号（1 - ${Math.max(1, total)}）`}>
            <input
              style={{ width: '100%', padding: '7px 9px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
              type="number"
              min={1}
              max={Math.max(1, total)}
              value={n}
              onChange={(e) => setN(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') go() }}
            />
          </FormField>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FormField label="查找方向">
                <select style={select} value={direction} onChange={(e) => setDirection(e.target.value as 'next' | 'prev')}>
                  <option value="next">仅向后查找</option>
                  <option value="prev">仅向前查找</option>
                </select>
              </FormField>
              <FormField label="索引字段">
                <select style={select} value={field} onChange={(e) => setField(e.target.value)}>
                  {dsCols.length === 0 && <option value="">（无字段）</option>}
                  {dsCols.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </FormField>
            </div>
            <FormField label="字段内容">
              <input
                style={{ width: '100%', padding: '7px 9px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') go() }}
                placeholder="输入要查找的内容"
              />
            </FormField>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12.5, color: '#1A1B1C' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <input type="checkbox" checked={cycle} onChange={(e) => setCycle(e.target.checked)} style={{ width: 14, height: 14 }} /> 循环查找
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <input type="checkbox" checked={fuzzy} onChange={(e) => setFuzzy(e.target.checked)} style={{ width: 14, height: 14 }} /> 模糊查找（包含）
              </label>
            </div>
          </>
        )}
        {found && <div style={{ fontSize: 12, color: '#C0392B' }}>{found}</div>}
        <div style={{ fontSize: 11, color: '#9CA3AF' }}>共 {Math.max(0, total)} 条记录</div>
      </div>
    </Modal>
  )
}

/** 电子称（选项 → 电子称，硬件连接配置） */
export function WeighDialog({ onClose }: { onClose: () => void }) {
  const [port, setPort] = useState('COM1')
  const [baud, setBaud] = useState('9600')
  return (
    <Modal title="电子称" onClose={onClose} width={420} footer={<>
      <button type="button" style={ghostStyle} onClick={onClose}>取消</button>
      <button type="button" style={btnStyle} onClick={() => { onClose() }}>保存</button>
    </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <FormField label="串口">
            <input style={{ width: '100%', padding: '7px 9px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} value={port} onChange={(e) => setPort(e.target.value)} />
          </FormField>
          <FormField label="波特率">
            <input style={{ width: '100%', padding: '7px 9px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} value={baud} onChange={(e) => setBaud(e.target.value)} />
          </FormField>
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.6 }}>
          电子称对接功能：连接电子称后可将称重数值作为「键盘输入」数据源填充到标签。请先完成串口参数配置，再连接真实设备。
        </div>
      </div>
    </Modal>
  )
}

/** 查找更新版本（帮助 → 查找更新版本） */
export function UpdateDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="查找更新版本" onClose={onClose} width={400} footer={<button type="button" style={btnStyle} onClick={onClose}>确定</button>}>
      <div style={{ fontSize: 13, color: '#1A1B1C', lineHeight: 1.8 }}>
        当前已是最新版本 <b>0.1.0</b>。
        <br />
        <span style={{ color: '#6B7280' }}>可通过官网了解后续版本动态。</span>
      </div>
    </Modal>
  )
}

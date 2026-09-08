import { useMemo, useState } from 'react'
import type { LabelDoc, LabelObject } from '../types'
import Modal from './Modal'

interface Props {
  doc: LabelDoc
  onSave: (order: string[]) => void
  onClose: () => void
}

/** 收集所有键盘输入数据源（按对象顺序去重） */
export function collectKeyboardLabels(d: LabelDoc): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const walk = (arr: LabelObject[]) => {
    for (const o of arr) {
      if (o.type === 'group') {
        walk(o.children)
        continue
      }
      if (('source' in o) && o.source && o.source.kind === 'keyboard') {
        const label = o.source.label || '请输入'
        if (!seen.has(label)) {
          seen.add(label)
          out.push(label)
        }
      }
      // 附加数据源（子串）中的键盘输入也需收集
      const subs = ('subSources' in o ? (o as { subSources?: Array<import('../types').DataSource> }).subSources : undefined) ?? []
      for (const s of subs) {
        if (s.kind === 'keyboard') {
          const label = s.label || '请输入'
          if (!seen.has(label)) {
            seen.add(label)
            out.push(label)
          }
        }
      }
    }
  }
  walk(d.objects)
  return out
}

/** 键盘输入变量顺序（编辑 → 键盘输入变量顺序） */
export default function KeyInputOrderDialog({ doc, onSave, onClose }: Props) {
  const all = useMemo(() => collectKeyboardLabels(doc), [doc])
  const saved = doc.keyboardOrder ?? []
  const [order, setOrder] = useState<string[]>(() => {
    const rest = all.filter((l) => !saved.includes(l))
    return [...saved.filter((l) => all.includes(l)), ...rest]
  })

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    setOrder(next)
  }

  return (
    <Modal
      title="键盘输入变量顺序"
      onClose={onClose}
      width={480}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '7px 18px', borderRadius: 7, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(order)
              onClose()
            }}
            style={{ padding: '7px 22px', borderRadius: 7, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
          >
            确定
          </button>
        </>
      }
    >
      {all.length === 0 ? (
        <div style={{ fontSize: 13, color: '#6B7280', padding: '30px 0', textAlign: 'center' }}>当前模板没有「键盘输入」数据源对象</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>打印时按以下顺序弹出输入框（点按右侧箭头调整顺序）：</div>
          {order.map((label, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #ECEBE6', borderRadius: 8, padding: '6px 8px', background: '#FAFAF7' }}>
              <span style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: '#EAF3FB', color: '#2E6E93', fontSize: 12, fontWeight: 600 }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 13, color: '#1A1B1C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="上移" style={{ border: '1px solid #D5D4CD', background: '#fff', width: 28, height: 28, borderRadius: 6, cursor: i === 0 ? 'not-allowed' : 'pointer', opacity: i === 0 ? 0.4 : 1, fontSize: 14 }}>↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1} title="下移" style={{ border: '1px solid #D5D4CD', background: '#fff', width: 28, height: 28, borderRadius: 6, cursor: i === order.length - 1 ? 'not-allowed' : 'pointer', opacity: i === order.length - 1 ? 0.4 : 1, fontSize: 14 }}>↓</button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

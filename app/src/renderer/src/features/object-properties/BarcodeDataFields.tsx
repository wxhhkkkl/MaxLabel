import type { BarcodeObj, BarcodeOptions, LabelObject } from '../../types'
import { FormField } from '../../dialogs/Modal'

interface Props {
  obj: BarcodeObj
  onPatch: (patch: Partial<LabelObject>) => void
}

/** 条码数据页签。显示人读文本是正式模型字段，避免把临时 UI 字段写进文档。 */
export default function BarcodeDataFields({ obj, onPatch }: Props) {
  const options = obj.barcodeOptions ?? {}
  const patchOptions = (patch: Partial<BarcodeOptions>) => onPatch({ barcodeOptions: { ...options, ...patch } } as never)
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
          <input type="checkbox" checked={obj.showText} onChange={(e) => onPatch({ showText: e.target.checked })} />
          显示人读文本
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormField label="人读字符位置">
          <select value={options.humanPosition ?? 'below'} onChange={(e) => patchOptions({ humanPosition: e.target.value as BarcodeOptions['humanPosition'] })} style={{ padding: '6px 8px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
            <option value="below">条码下方</option>
            <option value="above">条码上方</option>
            <option value="none">不显示</option>
          </select>
        </FormField>
        <FormField label="人读字符对齐">
          <select value={options.humanAlign ?? 'center'} onChange={(e) => patchOptions({ humanAlign: e.target.value as BarcodeOptions['humanAlign'] })} style={{ padding: '6px 8px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
            <option value="left">左对齐</option>
            <option value="center">居中</option>
            <option value="right">右对齐</option>
          </select>
        </FormField>
      </div>
      <FormField label="人读字符垂直偏移（mm）">
        <input type="number" min={0} max={100} step={0.1} value={options.humanOffsetMm ?? 0} onChange={(e) => patchOptions({ humanOffsetMm: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })} style={{ padding: '6px 8px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, width: 72, fontFamily: 'inherit' }} />
      </FormField>
      <FormField label="字符模板" hint="一个 '?' 表示原有数据的一个字符，其它字符插入数据序列。如数据 0123456789，模板 (01)??… 输出 (01)0123456789">
        <input
          style={{ padding: '6px 8px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
          value={obj.charTemplate ?? ''}
          onChange={(e) => onPatch({ charTemplate: e.target.value })}
          placeholder="(01)??????????"
        />
      </FormField>
    </>
  )
}

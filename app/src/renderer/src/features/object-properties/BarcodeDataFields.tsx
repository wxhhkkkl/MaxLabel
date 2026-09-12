import type { BarcodeObj, LabelObject } from '../../types'
import { FormField } from '../../dialogs/Modal'

interface Props {
  obj: BarcodeObj
  onPatch: (patch: Partial<LabelObject>) => void
}

/** 条码数据页签。显示人读文本是正式模型字段，避免把临时 UI 字段写进文档。 */
export default function BarcodeDataFields({ obj, onPatch }: Props) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
          <input type="checkbox" checked={obj.showText} onChange={(e) => onPatch({ showText: e.target.checked })} />
          显示人读文本
        </label>
      </div>
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

import { useState } from 'react'
import Modal from './Modal'
import { DEFAULT_LAYER_ID, MAX_LAYER_NAME_LENGTH, type Layer } from '../../../shared/domain/layers'
import { useI18n } from '../features/i18n/useI18n'
import { localizePropertyLabel } from '../../../shared/i18n/property.en-US'

export interface LayerPropsPatch {
  name: string
  visible: boolean
  locked: boolean
}

/**
 * 图层属性 / 重命名（019 / FR-008）
 *
 * 两项共用一个对话框：重命名只聚焦名称，属性页可同时改名称、可见、锁定。
 */
export default function LayerPropsDialog({
  layer,
  mode,
  onClose,
  onSave
}: {
  layer: Layer
  mode: 'rename' | 'properties'
  onClose: () => void
  onSave: (patch: LayerPropsPatch) => void
}) {
  const { language } = useI18n()
  const L = (text: string) => localizePropertyLabel(text, language)
  const [name, setName] = useState(layer.name)
  const [visible, setVisible] = useState(layer.visible !== false)
  const [locked, setLocked] = useState(layer.locked === true)
  const [error, setError] = useState('')

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError(L('名称不能为空'))
      return
    }
    onSave({ name: trimmed.slice(0, MAX_LAYER_NAME_LENGTH), visible, locked })
  }

  return (
    <Modal
      title={mode === 'rename' ? L('重命名图层') : L('图层属性')}
      onClose={onClose}
      width={380}
      testId="layer-props-dialog"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={{ padding: '6px 16px' }}>{L('取消')}</button>
          <button type="button" data-testid="layer-props-save" onClick={submit} style={{ padding: '6px 16px' }}>{L('确定')}</button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12.5 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ color: '#6B7280' }}>{L('名称')}</span>
          <input
            data-testid="layer-props-name"
            autoFocus
            value={name}
            maxLength={MAX_LAYER_NAME_LENGTH}
            onChange={(e) => { setName(e.target.value); setError('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            style={{ height: 28, padding: '0 8px' }}
          />
        </label>
        {mode === 'properties' && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
              {L('可见')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} />
              {L('锁定')}
            </label>
            {layer.id === DEFAULT_LAYER_ID && (
              <p style={{ margin: 0, color: '#8A97B5', fontSize: 12 }}>{L('默认图层不可删除；名称可以修改。')}</p>
            )}
          </>
        )}
        {error && <p style={{ margin: 0, color: '#B42318', fontSize: 12 }}>{error}</p>}
      </div>
    </Modal>
  )
}

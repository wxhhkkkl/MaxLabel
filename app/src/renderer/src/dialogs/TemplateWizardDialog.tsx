import { useState } from 'react'
import Modal from './Modal'

export type WizardChoice = 'open' | 'new' | 'help' | 'tutorial'

interface Props {
  onNext: (choice: WizardChoice, skip: boolean) => void
  onClose: () => void
}

const choices: Array<{ value: WizardChoice; label: string }> = [
  { value: 'open', label: '打开一个现有的标签模板' },
  { value: 'new', label: '新建标签模板' },
  { value: 'help', label: '查看 LabelShop 联机帮助' },
  { value: 'tutorial', label: '查看 LabelShop 在线使用教程' }
]

export default function TemplateWizardDialog({ onNext, onClose }: Props) {
  const [choice, setChoice] = useState<WizardChoice>('new')
  const [skip, setSkip] = useState(false)
  return (
    <div data-testid="template-wizard">
      <Modal
        title="模板向导"
        onClose={onClose}
        width={540}
        footer={(
          <>
            <button data-testid="wizard-next" autoFocus type="button" onClick={() => onNext(choice, skip)} style={{ minWidth: 78 }}>下一步</button>
            <button data-testid="wizard-cancel" type="button" onClick={onClose} style={{ minWidth: 78 }}>取消</button>
          </>
        )}
      >
        <div style={{ color: '#333', lineHeight: 1.7, marginBottom: 18 }}>
          您可以选择打开一个现有的标签模板文档进行工作，也可以新建一个标签模板。
        </div>
        <fieldset style={{ border: '1px solid #d9d9d9', padding: '12px 16px', margin: 0 }}>
          <legend style={{ padding: '0 6px' }}>请选择：</legend>
          {choices.map((item) => (
            <label key={item.value} style={{ display: 'block', margin: '8px 0', cursor: 'pointer' }}>
              <input
                data-testid={`wizard-choice-${item.value}`}
                type="radio"
                name="template-wizard-choice"
                value={item.value}
                checked={choice === item.value}
                onChange={() => setChoice(item.value)}
                style={{ marginRight: 8 }}
              />
              {item.label}
            </label>
          ))}
        </fieldset>
        <label style={{ display: 'block', marginTop: 18, cursor: 'pointer' }}>
          <input data-testid="wizard-skip" type="checkbox" checked={skip} onChange={(event) => setSkip(event.target.checked)} style={{ marginRight: 8 }} />
          下次启动时不再使用向导
        </label>
      </Modal>
    </div>
  )
}

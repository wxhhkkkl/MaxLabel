import { useState } from 'react'
import { HELP_SECTIONS } from '../../../shared/i18n/help'
import { useI18n } from '../features/i18n/useI18n'
import Modal from './Modal'

export default function HelpDialog({ onClose }: { onClose: () => void }) {
  const { language, t } = useI18n()
  const sections = HELP_SECTIONS[language]
  const [key, setKey] = useState(sections[0].key)
  const sec = sections.find((section) => section.key === key) ?? sections[0]
  return (
    <Modal title={t('help.dialog.title')} onClose={onClose} width={680} testId="help-dialog">
      <div style={{ display: 'flex', gap: 12, minHeight: 380 }}>
        <div style={{ width: 150, flexShrink: 0, borderRight: '1px solid #ECEBE6', paddingRight: 8 }}>
          {sections.map((section) => (
            <button
              key={section.key}
              type="button"
              data-testid="help-section"
              data-help-key={section.key}
              onClick={() => setKey(section.key)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                marginBottom: 4,
                borderRadius: 6,
                border: 'none',
                background: key === section.key ? '#E8F1F6' : 'transparent',
                color: key === section.key ? '#2E6E93' : '#1A1B1C',
                fontWeight: key === section.key ? 600 : 400,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              {section.title}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0, maxHeight: 380, overflow: 'auto' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1B1C', marginBottom: 4 }}>{sec.title}</div>
          <div style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 12 }}>{sec.intro}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sec.items.map((item, index) => (
              <div key={index}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1B1C', marginBottom: 2 }}>{item.t}</div>
                <div style={{ fontSize: 12.5, color: '#4B5563', lineHeight: 1.6 }}>{item.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

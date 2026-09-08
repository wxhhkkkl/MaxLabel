import Modal from './Modal'

interface Props {
  onClose: () => void
}

export default function FeedbackDialog({ onClose }: Props) {
  const rows: Array<{ k: string; v: string }> = [
    { k: '客服电话', v: '4000-987-360' },
    { k: '客服 QQ', v: '4000-987-360' },
    { k: '客服邮箱', v: 'Yanhs@360Code.com' },
    { k: '官方网址', v: 'https://www.360code.com/' }
  ]
  return (
    <Modal title="建议与反馈" onClose={onClose} width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, color: '#4A4B4C', lineHeight: 1.7 }}>
          在使用过程中有任何建议或遇到问题，欢迎通过以下方式联系我们。您的反馈将帮助我们持续改进产品。
        </div>
        <div style={{ border: '1px solid #ECEBE6', borderRadius: 8, overflow: 'hidden' }}>
          {rows.map((r, i) => (
            <div key={r.k} style={{ display: 'flex', padding: '9px 12px', background: i % 2 ? '#FAFAF7' : '#fff', borderBottom: i < rows.length - 1 ? '1px solid #ECEBE6' : 'none' }}>
              <div style={{ width: 110, flexShrink: 0, fontSize: 13, color: '#6B7280' }}>{r.k}</div>
              <div style={{ fontSize: 13, color: '#1A1B1C', fontWeight: 500 }}>{r.v}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: '#6B7280' }}>客服工作时间：周一至周五 9:00 – 18:00（法定节假日除外）。</div>
      </div>
    </Modal>
  )
}

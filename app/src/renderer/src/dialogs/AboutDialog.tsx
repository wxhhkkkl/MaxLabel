interface Props {
  onClose: () => void
}

export default function AboutDialog({ onClose }: Props) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, width: 400, maxWidth: '94vw', padding: 24, textAlign: 'center', boxShadow: '0 16px 60px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 1, color: '#2E6E93' }}>MaxLabel</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>条码标签设计打印软件</div>
        <div style={{ fontSize: 12, color: '#9AA0A6', marginTop: 14, lineHeight: 1.9 }}>
          版本 0.1.0
          <br />
          兼容「签赋 LabelShop」操作习惯与标签工作流
          <br />
          Electron + React + Fabric.js + bwip-js
        </div>
        <div style={{ fontSize: 12, color: '#9AA0A6', marginTop: 8 }}>
          指令集：TSPL / ZPL / CPCL · 端口：驱动 / 文件 / TCP / COM / 蓝牙 / USB
        </div>
        <button type="button" onClick={onClose} style={{ marginTop: 20, padding: '8px 26px', borderRadius: 8, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
          确定
        </button>
      </div>
    </div>
  )
}

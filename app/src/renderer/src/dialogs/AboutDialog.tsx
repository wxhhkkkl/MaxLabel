import { useEffect, useState } from 'react'
import Modal from './Modal'
import { barcodeToDataURLEx } from '../editor/barcode'

interface Props {
  onClose: () => void
  /** 「激活」按钮：切到「授权与激活」对话框（真机 66-dlg-about.png 里这个按钮就是这个用途） */
  onActivate?: () => void
}

interface LicenseState {
  active: boolean
  holder: string | null
  machineId: string
}

/** 真机「关于」对话框（parity/reference/labelshop/66-dlg-about.png，829x598）的结构：
 *  程序图标 + `产品名 [ 版本 - 激活状态 ]  (版本号) 位数` + `产品ID: 未激活` + 按钮「激活」；
 *  右侧二维码 + 「扫一扫下载 云马通APP」；下方公司行 + 官网链接；分隔线；两行版权敬告；右下「确定」。
 *  复刻版照抄这套骨架，文案换成自有品牌（产品名/官网/二维码指向本仓库）。 */
export default function AboutDialog({ onClose, onActivate }: Props) {
  const [version, setVersion] = useState('')
  const [state, setState] = useState<LicenseState | null>(null)
  const [qr, setQr] = useState('')

  const repoUrl = 'https://github.com/wxhhkkkl/MaxLabel'

  useEffect(() => {
    void window.maxlabel.appVersion().then((r) => setVersion(r?.version ?? '')).catch(() => undefined)
    void window.maxlabel.license.status().then((r) => { if (r.ok) setState(r.state) }).catch(() => undefined)
    void barcodeToDataURLEx('qrcode', repoUrl, 18, { dpi: 150, marginMm: 1, showText: false, moduleWidthMm: 0.5 })
      .then((url) => setQr(url))
      .catch(() => undefined)
  }, [])

  const editionLine = `MaxLabel [ 标准版 - ${state?.active ? '已激活' : '未激活'} ]  (${version || '—'}) 64位`

  return (
    <Modal
      title="关于 MaxLabel"
      onClose={onClose}
      width={620}
      testId="about-dialog"
      footer={
        <button type="button" data-testid="about-ok" onClick={onClose} style={{ padding: '7px 26px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
          确定
        </button>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) 150px', columnGap: 14, rowGap: 10, alignItems: 'start' }}>
        <div aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 6, background: 'linear-gradient(135deg,#5B8FF9,#2E6E93)', position: 'relative', flex: '0 0 auto' }}>
          <div style={{ position: 'absolute', inset: 11, border: '2px solid #fff', borderRight: 'none', borderRadius: '3px 0 0 3px' }} />
          <div style={{ position: 'absolute', inset: 15, background: 'repeating-linear-gradient(90deg,#fff 0 2px,transparent 2px 5px)' }} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div data-testid="about-version-line" style={{ fontSize: 13.5, color: '#1A1B1C' }}>{editionLine}</div>
          <div data-testid="about-product-id" style={{ fontSize: 13.5, color: '#1A1B1C', marginTop: 14 }}>
            产品ID: {state?.active ? (state.holder || '已激活') : '未激活'}
          </div>
          <div style={{ fontSize: 11.5, color: '#9AA0A6', marginTop: 6 }}>
            条码标签设计打印软件 · 兼容「签赋 LabelShop」操作习惯
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            data-testid="about-activate"
            onClick={onActivate}
            style={{ width: '100%', padding: '9px 0', border: '1px solid #C8C6BF', background: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
          >
            激活
          </button>
          {qr
            ? <img data-testid="about-qr" src={qr} alt="项目主页二维码" style={{ width: 92, height: 92, marginTop: 14, imageRendering: 'pixelated' }} />
            : <div style={{ width: 92, height: 92, margin: '14px auto 0', border: '1px solid #E4E3DD' }} aria-hidden="true" />}
          <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 6 }}>扫一扫访问项目主页</div>
        </div>

        <div />
        <div style={{ fontSize: 13, color: '#1A1B1C' }}>MaxLabel 项目组</div>
        <div />
        <div />
        <a data-testid="about-homepage" href={repoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#2E6E93' }}>{repoUrl}</a>
      </div>

      <div style={{ borderTop: '1px solid #E4E3DD', margin: '18px 0 14px' }} />
      <div style={{ fontSize: 12.5, color: '#4B5563', lineHeight: 1.7 }}>
        敬告：本计算机程序受著作权法和国际公约的保护，MaxLabel 在此授权您可以自由复制和传播本程序的免费版本。
      </div>
    </Modal>
  )
}

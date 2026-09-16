import { useState } from 'react'
import type { PrinterConfig } from '../types'
import Modal from './Modal'

interface Props {
  printer: PrinterConfig | null
  onInstall: (driver: 'tspl' | 'zpl' | 'cpcl', dpi: 203 | 300 | 600, portType: string) => void
  onRemove: () => void
  onClose: () => void
}

/** 品牌 → 常用指令集建议（对标原版"安装打印机"：按品牌定位选择指令集与分辨率） */
const BRAND_DRIVERS: Record<string, Array<'tspl' | 'zpl' | 'cpcl'>> = {
  '通用': ['tspl', 'zpl', 'cpcl'],
  '佳博 Gprinter': ['tspl', 'zpl', 'cpcl'],
  '汉印 HPRT': ['cpcl', 'tspl', 'zpl'],
  '芯烨 Xprinter': ['tspl', 'zpl', 'cpcl'],
  '得力 Deli': ['tspl', 'zpl'],
  '启锐 QIRUI': ['tspl', 'zpl', 'cpcl'],
  '斑马 Zebra': ['zpl'],
  '霍尼韦尔 Honeywell': ['zpl', 'cpcl'],
  'TSC': ['tspl'],
  '立象 Argox': ['tspl', 'zpl', 'cpcl']
}

const DRIVER_NAME: Record<string, string> = { tspl: 'TSPL', zpl: 'ZPL', cpcl: 'CPCL' }
const DPIS = [203, 300, 600] as const

const selStyle = {
  padding: '7px 10px',
  border: '1px solid #D5D4CD',
  borderRadius: 6,
  fontSize: 13,
  background: '#fff',
  color: '#1A1B1C',
  fontFamily: 'inherit',
  width: '100%'
} as const

export default function PrintersInstallDialog({ printer, onInstall, onRemove, onClose }: Props) {
  const [brand, setBrand] = useState<string>('通用')
  const [driver, setDriver] = useState<'tspl' | 'zpl' | 'cpcl'>(BRAND_DRIVERS['通用'][0])
  const [dpi, setDpi] = useState<203 | 300 | 600>(203)
  const [portType, setPortType] = useState('file')

  const curLabel = printer ? `${DRIVER_NAME[printer.driver] ?? printer.driver.toUpperCase()} · ${printer.dpi}dpi · ${printer.port.type}` : '未安装'

  return (
    <Modal title="安装打印机" testId="printer-install-dialog" onClose={onClose} width={640}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div data-testid="printer-install-guidance" style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.7 }}>
          选择条码标签打印机品牌与指令集、分辨率后安装。未收录的品牌可分别尝试 <b>ZPL</b>、<b>TSPL</b>、<b>CPCL</b> 三套指令集（签赋LabelShop不保证未适配品牌输出结果）。
          <br />
          分辨率不匹配时指令仍可输出，但结果会放大或缩小：偏大请改小分辨率，偏小请改大分辨率。
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 5 }}>打印机品牌</div>
            <select
              data-testid="printer-install-brand"
              value={brand}
              onChange={(e) => {
                const b = e.target.value
                setBrand(b)
                const list = BRAND_DRIVERS[b] ?? BRAND_DRIVERS['通用']
                if (!list.includes(driver)) setDriver(list[0])
              }}
              style={selStyle}
            >
              {Object.keys(BRAND_DRIVERS).map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 5 }}>指令集</div>
            <select data-testid="printer-install-driver" value={driver} onChange={(e) => setDriver(e.target.value as 'tspl' | 'zpl' | 'cpcl')} style={selStyle}>
              {(BRAND_DRIVERS[brand] ?? BRAND_DRIVERS['通用']).map((d) => (
                <option key={d} value={d}>
                  {DRIVER_NAME[d]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 5 }}>分辨率</div>
            <select data-testid="printer-install-dpi" value={dpi} onChange={(e) => setDpi(Number(e.target.value) as 203 | 300 | 600)} style={selStyle}>
              {DPIS.map((d) => (
                <option key={d} value={d}>
                  {d} dpi
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 5 }}>输出端口</div>
            <select data-testid="printer-install-port" value={portType} onChange={(e) => setPortType(e.target.value)} style={selStyle}>
              <option value="file">指令文件</option>
              <option value="tcp">TCP/IP</option>
              <option value="com">COM 串口</option>
              <option value="bluetooth">蓝牙</option>
              <option value="usb">USB</option>
              <option value="driver">Windows 驱动</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            data-testid="printer-install-submit"
            onClick={() => onInstall(driver, dpi, portType)}
            style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13.5, fontFamily: 'inherit' }}
          >
            安装
          </button>
          <button
            type="button"
            data-testid="printer-install-remove"
            onClick={onRemove}
            disabled={!printer}
            style={{ padding: '9px 22px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', color: printer ? '#D4380D' : '#bbb', cursor: printer ? 'pointer' : 'not-allowed', fontSize: 13.5, fontFamily: 'inherit' }}
          >
            移除（卸载）
          </button>
        </div>

        <div style={{ borderTop: '1px solid #E4E3DD', paddingTop: 10 }}>
          <div style={{ fontSize: 12.5, color: '#1A1B1C', marginBottom: 6 }}>
            当前已安装打印机：<b>{curLabel}</b>
          </div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>
            安装后打印机设置随标签模板保存；可在打印面板「打印机 → 设置」中进一步调整速度、浓度、热敏/热转印、标签类型、介质处理等属性。
          </div>
        </div>
      </div>
    </Modal>
  )
}

import { describe, expect, it } from 'vitest'
import { IPC_CHANNELS } from '@shared/ipcContract'
import { assertKnownIpcChannel, assertTrustedRenderer } from '@main/ipc/senderGuard'
import {
  validateCloudServerUrl,
  validateCommandPayload,
  validateDbConnection,
  validatePort,
  validatePrintPayload
} from '@main/ipc/validation'

describe('IPC channel registry', () => {
  it('contains unique channel names and rejects unknown channels', () => {
    const channels = Object.values(IPC_CHANNELS)
    expect(new Set(channels).size).toBe(channels.length)
    expect(() => assertKnownIpcChannel('print-label')).not.toThrow()
    expect(() => assertKnownIpcChannel('not:a-channel')).toThrow(/未注册的 IPC 通道/)
  })

  it('accepts only the authenticated main window as the sender', () => {
    const webContents = {}
    const owner = { webContents }
    expect(() => assertTrustedRenderer({ sender: webContents } as never, () => owner as never)).not.toThrow()
    expect(() => assertTrustedRenderer({ sender: {} } as never, () => owner as never)).toThrow(/未授权的渲染进程请求/)
    expect(() => assertTrustedRenderer({ sender: {} } as never, () => null)).toThrow(/未授权的渲染进程请求/)
  })
})

describe('cloud URL and database validation', () => {
  it('allows offline and normalizes HTTPS URLs, rejecting plain HTTP', () => {
    expect(validateCloudServerUrl('')).toBe('')
    expect(validateCloudServerUrl('offline')).toBe('')
    expect(validateCloudServerUrl('https://cloud.example.com/')).toBe('https://cloud.example.com')
    expect(() => validateCloudServerUrl('http://cloud.example.com')).toThrow(/HTTPS/)
  })

  it('turns an empty database password into the secure-store fallback', () => {
    expect(validateDbConnection({ id: 'db', name: '数据库', driver: 'sqlserver', password: '' }).password).toBeUndefined()
  })
})

describe('command payload validation', () => {
  it('rejects empty command payloads', () => {
    expect(() =>
      validateCommandPayload({ segments: [], encoding: 'utf8', port: { type: 'file', encoding: 'utf8' } })
    ).toThrow(/打印指令为空/)
  })
})

describe('print port validation', () => {
  it('drops unknown fields', () => {
    const port = validatePort({ type: 'tcp', encoding: 'utf8', tcpHost: '127.0.0.1', tcpPort: 9100, injected: 'ignored' })
    expect((port as unknown as Record<string, unknown>).injected).toBeUndefined()
    expect(port).toEqual({ type: 'tcp', encoding: 'utf8', tcpHost: '127.0.0.1', tcpPort: 9100 })
  })

  it('preserves LPT configuration without unknown fields', () => {
    expect(validatePort({ type: 'lpt', encoding: 'gbk', lptPort: 'LPT2', injected: 'ignored' })).toEqual({
      type: 'lpt',
      encoding: 'gbk',
      lptPort: 'LPT2'
    })
  })

  it('validates USB, driver, TCP, Bluetooth, COM, cloudbox and serial parameters', () => {
    expect(validatePort({ type: 'usb', encoding: 'utf8', usbPort: 'USB001 (Gprinter GP-1324D)' })).toEqual({
      type: 'usb',
      encoding: 'utf8',
      usbPort: 'USB001 (Gprinter GP-1324D)'
    })
    expect(() => validatePort({ type: 'usb', encoding: 'utf8' })).toThrow(/USB 打印机端口/)
    expect(validatePort({ type: 'driver', encoding: 'utf8' })).toEqual({ type: 'driver', encoding: 'utf8' })
    expect(validatePort({ type: 'tcp', encoding: 'utf8', tcpHost: 'printer.local', tcpPort: 9100 })).toEqual({
      type: 'tcp',
      encoding: 'utf8',
      tcpHost: 'printer.local',
      tcpPort: 9100
    })
    expect(validatePort({ type: 'bluetooth', encoding: 'utf8', comPort: 'COM4', baudRate: 115200 })).toEqual({
      type: 'bluetooth',
      encoding: 'utf8',
      comPort: 'COM4',
      baudRate: 115200
    })
    expect(validatePort({ type: 'com', encoding: 'utf8', comPort: 'COM3', baudRate: 9600 })).toEqual({
      type: 'com',
      encoding: 'utf8',
      comPort: 'COM3',
      baudRate: 9600
    })
    expect(validatePort({ type: 'cloudbox', encoding: 'utf8', tcpHost: 'box.local', tcpPort: 9100 })).toEqual({
      type: 'cloudbox',
      encoding: 'utf8',
      tcpHost: 'box.local',
      tcpPort: 9100
    })
    expect(
      validatePort({ type: 'com', encoding: 'utf8', comPort: 'COM3', baudRate: 9600, dataBits: 7, parity: 'even', stopBits: 'two', flowControl: 'rtsCts' })
    ).toEqual({ type: 'com', encoding: 'utf8', comPort: 'COM3', baudRate: 9600, dataBits: 7, parity: 'even', stopBits: 'two', flowControl: 'rtsCts' })
  })

  it('rejects invalid serial and TCP parameters', () => {
    expect(() => validatePort({ type: 'com', encoding: 'utf8', comPort: 'COM3', dataBits: 9 })).toThrow(/数据位只能是 7 或 8/)
    expect(() => validatePort({ type: 'com', encoding: 'utf8', comPort: 'COM3', stopBits: 'three' })).toThrow(/停止位只能是 1 \/ 1.5 \/ 2/)
    expect(() => validatePort({ type: 'com', encoding: 'utf8', comPort: 'COM3', flowControl: 'rts' })).toThrow(/流控制取值无效/)
    expect(() => validatePort({ type: 'tcp', encoding: 'utf8', tcpHost: 'bad host', tcpPort: 9100 })).toThrow(/TCP 地址格式无效/)
    expect(() => validatePort({ type: 'tcp', encoding: 'utf8', tcpHost: '127.0.0.1', tcpPort: 65536 })).toThrow(/TCP 端口超出范围/)
    expect(() => validatePort({ type: 'com', encoding: 'utf8', comPort: 'COM0', baudRate: 9600 })).toThrow(/串口/)
    expect(() => validatePort({ type: 'lpt', encoding: 'utf8', lptPort: 'USB1' })).toThrow(/LPT 端口名称无效/)
  })
})

describe('driver print payload validation', () => {
  it('rejects a payload without pages or invalid dimensions', () => {
    expect(() => validatePrintPayload({ pages: [], widthMm: 60, heightMm: 40 })).toThrow()
    expect(() => validatePrintPayload({ pages: [{ dataUrl: 'data:image/png;base64,AA' }], widthMm: 0, heightMm: 40 })).toThrow()
  })
})

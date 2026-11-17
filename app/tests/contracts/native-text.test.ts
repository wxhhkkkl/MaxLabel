import { describe, expect, it } from 'vitest'
import { IPC_CHANNELS } from '@shared/ipcContract'
import { assertKnownIpcChannel } from '@main/ipc/senderGuard'
import { validateNativeTextRequest } from '@shared/print/nativeText'

const payload = {
  text: '本品为初级农产品',
  fontFamily: 'Arial',
  fontSizePt: 6,
  dpi: 203,
  boxWidthPx: 480,
  wrap: true, textAlign: 'left',
  lineHeightFactor: 1.16,
  bold: false,
  italic: false,
  underline: false,
  strikeout: false
}

describe('GDI 文本 IPC', () => {
  it('通道已注册且唯一', () => {
    expect(IPC_CHANNELS.nativeTextRasterize).toBe('native-text:rasterize')
    expect(() => assertKnownIpcChannel('native-text:rasterize')).not.toThrow()
  })

  it('只保留白名单字段，未知字段被丢弃', () => {
    const raw = { ...payload, injected: 'drop-me' }
    const result = validateNativeTextRequest(raw) as unknown as Record<string, unknown>
    expect(result.injected).toBeUndefined()
    expect(result).toEqual(payload)
  })

  it('拒绝非字符串/超长文本与控制字符字体名', () => {
    expect(() => validateNativeTextRequest({ ...payload, text: 123 })).toThrow()
    expect(() => validateNativeTextRequest({ ...payload, text: 'x'.repeat(5000) })).toThrow()
    expect(() => validateNativeTextRequest({ ...payload, fontFamily: 'Arial\nBold' })).toThrow()
  })

  it('拒绝伪造的超大画布参数', () => {
    expect(() => validateNativeTextRequest({ ...payload, boxWidthPx: 1e9 })).toThrow()
    expect(() => validateNativeTextRequest({ ...payload, dpi: 1e6 })).toThrow()
    expect(() => validateNativeTextRequest({ ...payload, lineHeightFactor: 0 })).toThrow()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { ensureWindowsPrinterQueue, isManagedQueueName, normalizeUsbPort, queueNameFor } from '@main/printing/printerQueue'

describe('printer queue setup', () => {
  it('normalizes USB ports and rejects other port types', () => {
    expect(normalizeUsbPort(' usb002 ')).toBe('USB002')
    expect(normalizeUsbPort('USB002 (HPRTT310)')).toBe('USB002')
    expect(() => normalizeUsbPort('COM3')).toThrow(/USB/)
    expect(queueNameFor('USB002', 'Gprinter / T310:*')).toBe('MaxLabel Gprinter T310 (USB002)')
  })

  it('识别应用自己创建的 USB 队列（仅供 USB 直连内部传输，不应出现在打印机列表里）', () => {
    expect(isManagedQueueName('MaxLabel HPRT TSPL-N (203 dpi) (USB002)')).toBe(true)
    expect(isManagedQueueName(' MaxLabel Gprinter T310 (USB001) ')).toBe(true)
    expect(isManagedQueueName('Zenpert 4T530')).toBe(false)
    expect(isManagedQueueName('MaxLabel Office (LPT1)')).toBe(false)
  })

  it('reuses an existing queue on the same USB port', async () => {
    const run = vi.fn(async () => ({ ok: true, stdout: 'EXISTS:Existing Queue\n', stderr: '' }))
    await expect(ensureWindowsPrinterQueue('USB002', 'Gprinter', run)).resolves.toEqual({
      ok: true,
      queueName: 'Existing Queue',
      created: false
    })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('creates a generic queue when the USB port has none', async () => {
    const run = vi.fn()
      .mockResolvedValueOnce({ ok: true, stdout: 'NONE\n', stderr: '' })
      .mockResolvedValueOnce({ ok: true, stdout: 'OK:MaxLabel Gprinter (USB002)\n', stderr: '' })
    await expect(ensureWindowsPrinterQueue('USB002', 'Gprinter', run)).resolves.toEqual({
      ok: true,
      queueName: 'MaxLabel Gprinter (USB002)',
      created: true
    })
    expect(run).toHaveBeenCalledTimes(2)
    expect(run.mock.calls[1][0]).toContain('Generic / Text Only')
  })

  it('surfaces the creation error when direct and elevated attempts both fail', async () => {
    const run = vi.fn()
      .mockResolvedValueOnce({ ok: true, stdout: 'NONE\n', stderr: '' })
      .mockResolvedValueOnce({ ok: false, stdout: '', stderr: 'Access is denied' })
      .mockResolvedValueOnce({ ok: false, stdout: '', stderr: 'UAC canceled' })
    const result = await ensureWindowsPrinterQueue('USB002', 'Gprinter', run)
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/Access is denied|管理员|UAC/)
    expect(run).toHaveBeenCalledTimes(3)
  })
})

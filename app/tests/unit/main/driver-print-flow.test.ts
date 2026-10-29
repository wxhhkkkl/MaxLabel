import { describe, expect, it, vi } from 'vitest'
import { runDriverPrint } from '@main/printing/driverPrintFlow'

describe('驱动端口打印顺序', () => {
  it('绑定了打印机时先静默打印，不弹对话框', async () => {
    const print = vi.fn(async () => true)
    const onDialog = vi.fn()

    const outcome = await runDriverPrint('Zenpert 4T530', print, { onDialog })

    expect(print).toHaveBeenCalledTimes(1)
    expect(print).toHaveBeenCalledWith(true)
    expect(onDialog).not.toHaveBeenCalled()
    expect(outcome).toEqual({ ok: true, usedDialog: false, canceled: false })
  })

  it('静默失败时才弹系统对话框重试', async () => {
    const calls: boolean[] = []
    const print = vi.fn(async (silent: boolean) => {
      calls.push(silent)
      return !silent
    })
    const onDialog = vi.fn()

    const outcome = await runDriverPrint('Zenpert 4T530', print, { onDialog })

    expect(calls).toEqual([true, false])
    expect(onDialog).toHaveBeenCalledTimes(1)
    expect(outcome).toEqual({ ok: true, usedDialog: true, canceled: false })
  })

  it('没绑定具体打印机时直接弹对话框', async () => {
    const print = vi.fn(async () => true)
    const onDialog = vi.fn()

    const outcome = await runDriverPrint('', print, { onDialog })

    expect(print).toHaveBeenCalledWith(false)
    expect(onDialog).toHaveBeenCalledTimes(1)
    expect(outcome).toEqual({ ok: true, usedDialog: true, canceled: false })
  })

  it('静默期间被用户取消就不再弹对话框', async () => {
    let canceled = false
    const print = vi.fn(async () => {
      canceled = true
      return false
    })
    const onDialog = vi.fn()

    const outcome = await runDriverPrint('Zenpert 4T530', print, { isCanceled: () => canceled, onDialog })

    expect(print).toHaveBeenCalledTimes(1)
    expect(onDialog).not.toHaveBeenCalled()
    expect(outcome).toEqual({ ok: false, usedDialog: false, canceled: true })
  })

  it('静默和对话框都失败时报告失败', async () => {
    const print = vi.fn(async () => false)

    const outcome = await runDriverPrint('Zenpert 4T530', print)

    expect(print).toHaveBeenCalledTimes(2)
    expect(outcome).toEqual({ ok: false, usedDialog: true, canceled: false })
  })
})

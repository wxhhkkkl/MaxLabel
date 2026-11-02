// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

type CacheModule = typeof import('@/features/shell/printerCache')

async function freshCache(): Promise<CacheModule> {
  vi.resetModules()
  return import('@/features/shell/printerCache')
}

function mockListPrinters(result: unknown): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async () => result)
  ;(window as unknown as { maxlabel: { listPrinters: typeof fn } }).maxlabel = { listPrinters: fn }
  return fn
}

describe('打印机列表缓存', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('首次加载后缓存；后续打开直接用缓存，不再枚举', async () => {
    const cache = await freshCache()
    const list = mockListPrinters({ ok: true, printers: [{ name: 'TSC TX600', displayName: 'TSC TX600' }] })

    await expect(cache.loadPrinterList()).resolves.toMatchObject({ printers: [{ name: 'TSC TX600' }] })
    expect(cache.peekPrinterList()?.printers).toHaveLength(1)
    await cache.loadPrinterList()
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('force 刷新会重新枚举并更新缓存', async () => {
    const cache = await freshCache()
    const list = mockListPrinters({ ok: true, printers: [{ name: 'A', displayName: 'A' }] })
    await cache.loadPrinterList()
    list.mockResolvedValue({ ok: true, printers: [{ name: 'B', displayName: 'B' }] })
    await cache.loadPrinterList(true)
    expect(list).toHaveBeenCalledTimes(2)
    expect(cache.peekPrinterList()?.printers.map((item) => item.name)).toEqual(['B'])
  })

  it('并发调用共享同一个请求', async () => {
    const cache = await freshCache()
    const list = mockListPrinters({ ok: true, printers: [] })
    await Promise.all([cache.loadPrinterList(), cache.loadPrinterList(), cache.loadPrinterList()])
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('枚举失败且没有旧缓存时返回空表且不缓存失败结果', async () => {
    const cache = await freshCache()
    const list = mockListPrinters({ ok: false, message: 'PowerShell failed' })
    list.mockRejectedValue(new Error('PowerShell failed'))
    await expect(cache.loadPrinterList()).resolves.toMatchObject({ printers: [] })
    expect(cache.peekPrinterList()).toBeNull()
  })

  it('刷新失败时保留上一次成功的列表', async () => {
    const cache = await freshCache()
    const list = mockListPrinters({ ok: true, printers: [{ name: 'A', displayName: 'A' }] })
    await cache.loadPrinterList()
    list.mockRejectedValue(new Error('PowerShell failed'))
    await expect(cache.loadPrinterList(true)).resolves.toMatchObject({ printers: [{ name: 'A' }] })
    expect(cache.peekPrinterList()?.printers[0].name).toBe('A')
  })
})

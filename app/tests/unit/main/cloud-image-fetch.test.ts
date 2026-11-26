import { describe, expect, it, vi } from 'vitest'
import { fetchCloudImage } from '@main/cloudImages'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const REF = 'labelshop:\\\\codingv\\AoAZHSklKSsvNTs9RkcF.png'
const OSS = 'https://cvsimg.oss-cn-beijing.aliyuncs.com/li/AoAZHSklKSsvNTs9RkcF.png'
const CODINGV = 'http://i.codingv.com/li/AoAZHSklKSsvNTs9RkcF.png'

function deps(responses: Record<string, { status: number; body: Buffer }>) {
  return {
    getBinary: vi.fn(async (url: string) => responses[url] ?? { status: 404, body: Buffer.alloc(0) }),
    decode: vi.fn(() => ({ width: 92, height: 85 }))
  }
}

describe('fetchCloudImage', () => {
  it('downloads from OSS and returns a data URL', async () => {
    const d = deps({ [OSS]: { status: 200, body: PNG } })
    const result = await fetchCloudImage(REF, d)
    expect(result).toMatchObject({ ok: true, fileName: 'AoAZHSklKSsvNTs9RkcF.png', url: OSS })
    expect(result.dataUrl).toBe(`data:image/png;base64,${PNG.toString('base64')}`)
    expect(d.getBinary).toHaveBeenCalledTimes(1)
  })

  it('falls back to i.codingv.com when OSS fails', async () => {
    const d = deps({ [OSS]: { status: 503, body: Buffer.alloc(0) }, [CODINGV]: { status: 200, body: PNG } })
    const result = await fetchCloudImage(REF, d)
    expect(result).toMatchObject({ ok: true, url: CODINGV })
    expect(d.getBinary).toHaveBeenCalledTimes(2)
  })

  it('rejects references that are not LabelShop cloud images without any request', async () => {
    const d = deps({})
    const result = await fetchCloudImage('C:\\images\\logo.png', d)
    expect(result.ok).toBe(false)
    expect(d.getBinary).not.toHaveBeenCalled()
  })

  it('rejects non-image payloads and oversized images', async () => {
    const html = deps({ [OSS]: { status: 200, body: Buffer.from('<html>404</html>') }, [CODINGV]: { status: 200, body: Buffer.from('<html>404</html>') } })
    expect((await fetchCloudImage(REF, html)).ok).toBe(false)

    const huge = deps({ [OSS]: { status: 200, body: PNG }, [CODINGV]: { status: 200, body: PNG } })
    huge.decode.mockReturnValue({ width: 10_000, height: 10_000 })
    expect((await fetchCloudImage(REF, huge)).ok).toBe(false)
  })

  it('reports the last failure message', async () => {
    const d = deps({})
    const result = await fetchCloudImage(REF, d)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('云图片下载失败')
  })
})

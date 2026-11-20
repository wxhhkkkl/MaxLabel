import { describe, expect, it, vi } from 'vitest'
import { mapArch, mapPlatform, resolveRemoteFeed } from '@main/update/updateFeedResolver'

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body } as unknown as Response
}

describe('remote update feed resolver（013 / Q89）', () => {
  it('maps node platform and arch to mall terms', () => {
    expect(mapPlatform('win32')).toBe('windows')
    expect(mapPlatform('darwin')).toBe('macos')
    expect(mapPlatform('linux')).toBe('linux')
    expect(mapPlatform('aix')).toBeNull()
    expect(mapArch('x64')).toBe('x64')
    expect(mapArch('arm64')).toBe('arm64')
    expect(mapArch('ia32')).toBe('x86')
    expect(mapArch('mips')).toBeNull()
  })

  it('returns the feed url when server says there is an update', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        code: 0,
        data: { hasUpdate: true, feedUrl: 'https://new.yuwangchenfa.com/app-api/software/feed/windows/x64/' }
      })
    ) as unknown as typeof fetch

    const feed = await resolveRemoteFeed({
      baseUrl: 'https://new.yuwangchenfa.com',
      tenantId: '162',
      currentVersion: '1.0.22',
      platform: 'windows',
      arch: 'x64',
      fetchImpl
    })

    expect(feed).toBe('https://new.yuwangchenfa.com/app-api/software/feed/windows/x64/')
    const calledUrl = String((fetchImpl as unknown as { mock: { calls: string[][] } }).mock.calls[0][0])
    expect(calledUrl).toContain('/app-api/software/update/check')
    expect(calledUrl).toContain('currentVersion=1.0.22')
    expect(calledUrl).toContain('platform=windows')
    expect(calledUrl).toContain('arch=x64')
    // app-api 必须带 tenant-id，否则后端 400「租户标识未传递」
    const init = (fetchImpl as unknown as { mock: { calls: [string, { headers?: Record<string, string> }][] } })
      .mock.calls[0][1]
    expect(init).toMatchObject({ headers: { 'tenant-id': '162' }, redirect: 'error' })
  })

  it('returns null when server says no update', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ code: 0, data: { hasUpdate: false } })) as unknown as typeof fetch

    expect(
      await resolveRemoteFeed({ baseUrl: 'https://new.yuwangchenfa.com', tenantId: '162', currentVersion: '1.0.23', platform: 'windows', arch: 'x64', fetchImpl })
    ).toBeNull()
  })

  it('reports network failure separately from no update', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch

    await expect(
      resolveRemoteFeed({ baseUrl: 'https://new.yuwangchenfa.com', tenantId: '162', currentVersion: '1.0.22', platform: 'windows', arch: 'x64', fetchImpl })
    ).rejects.toThrow('offline')
  })

  it('reports the HTTP error when the endpoint answers non-200', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, false)) as unknown as typeof fetch

    await expect(
      resolveRemoteFeed({ baseUrl: 'https://new.yuwangchenfa.com', tenantId: '162', currentVersion: '1.0.22', platform: 'windows', arch: 'x64', fetchImpl })
    ).rejects.toThrow('HTTP 500')
  })

  it.each(['http://new.yuwangchenfa.com/updates/', 'https://example.test/updates/', 'https://user@new.yuwangchenfa.com/updates/'])(
    'rejects an untrusted feed %s',
    async (feedUrl) => {
      const fetchImpl = vi.fn(async () => jsonResponse({ code: 0, data: { hasUpdate: true, feedUrl } }))
      await expect(resolveRemoteFeed({
        baseUrl: 'https://new.yuwangchenfa.com', tenantId: '162', currentVersion: '1.0.22',
        platform: 'windows', arch: 'x64', fetchImpl
      })).rejects.toThrow('受信任')
    }
  )
})

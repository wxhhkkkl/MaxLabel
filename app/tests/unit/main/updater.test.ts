import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@main/net', () => ({ httpGet: vi.fn() }))

import { httpGet } from '@main/net'
import { checkForUpdate, compareVersions, normalizeVersion, parseVersionManifest, resolveManifestUrl } from '@main/updater'

const httpGetMock = vi.mocked(httpGet)

beforeEach(() => {
  httpGetMock.mockReset()
})

describe('update version helpers', () => {
  it('normalizes and compares numeric versions', () => {
    expect(normalizeVersion('v1.2.3-beta.1')).toBe('1.2.3')
    expect(normalizeVersion('not-a-version')).toBeNull()
    expect(compareVersions('1.2.3', '1.10.0')).toBe(-1)
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
    expect(compareVersions('2.0', '1.9.9')).toBe(1)
  })

  it('parses version, latest and version_name manifests', () => {
    expect(parseVersionManifest('{"version":"1.2.3"}')).toEqual({ version: '1.2.3', url: undefined, notes: undefined })
    expect(parseVersionManifest('{"latest":"2.0.0","url":"https://example.com/a.exe","notes":"fix"}')).toEqual({
      version: '2.0.0',
      url: 'https://example.com/a.exe',
      notes: 'fix'
    })
    expect(parseVersionManifest('{"version_name":"3.0.0"}')?.version).toBe('3.0.0')
    expect(parseVersionManifest('not json')).toBeNull()
  })

  it('resolves the manifest URL from an override, the server, or nothing', () => {
    expect(resolveManifestUrl(undefined)).toBeNull()
    expect(resolveManifestUrl('https://cloud.example.com')).toBe('https://cloud.example.com/api/version')
    expect(resolveManifestUrl('https://cloud.example.com', 'https://cdn.example.com/version.json')).toBe('https://cdn.example.com/version.json')
  })
})

describe('update check', () => {
  it('returns unavailable without a server and never throws', async () => {
    await expect(checkForUpdate({ currentVersion: '1.0.22' })).resolves.toMatchObject({ status: 'unavailable', current: '1.0.22' })
  })

  it('reports an update when the manifest is newer', async () => {
    httpGetMock.mockResolvedValueOnce({ status: 200, body: '{"version":"1.1.0","notes":"new"}' })
    await expect(checkForUpdate({ currentVersion: '1.0.22', serverUrl: 'https://cloud.example.com' })).resolves.toMatchObject({
      status: 'update',
      current: '1.0.22',
      latest: '1.1.0',
      notes: 'new'
    })
  })

  it('reports latest when the manifest matches', async () => {
    httpGetMock.mockResolvedValueOnce({ status: 200, body: '{"version":"1.0.22"}' })
    await expect(checkForUpdate({ currentVersion: '1.0.22', serverUrl: 'https://cloud.example.com' })).resolves.toMatchObject({
      status: 'latest',
      latest: '1.0.22'
    })
  })

  it('maps a missing /api/version route to unavailable', async () => {
    httpGetMock.mockResolvedValueOnce({ status: 404, body: 'not found' })
    await expect(checkForUpdate({ currentVersion: '1.0.22', serverUrl: 'https://cloud.example.com' })).resolves.toMatchObject({
      status: 'unavailable',
      message: '更新服务器返回 404'
    })
  })

  it('maps network failures to unavailable', async () => {
    httpGetMock.mockRejectedValueOnce(new Error('offline'))
    await expect(checkForUpdate({ currentVersion: '1.0.22', serverUrl: 'https://cloud.example.com' })).resolves.toMatchObject({
      status: 'unavailable',
      message: '无法连接更新服务器，请检查网络或云服务器地址'
    })
  })
})

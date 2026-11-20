import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', async () => (await import('../../helpers/electronMock')).createElectronMock())
vi.mock('electron-updater', () => ({
  autoUpdater: {},
  CancellationToken: class {
    cancelled = false
    cancel() { this.cancelled = true }
  }
}))

import {
  compareVersions,
  createUpdateService,
  normalizeVersion,
  type UpdateServiceOptions
} from '@main/update/updateService'
import type { UpdaterLike } from '@main/update/updateTypes'
import { resolveRemoteFeed } from '@main/update/updateFeedResolver'
import type { UpdateStateDto } from '@shared/ipcContract'

type FakeToken = { cancelled: boolean }

class FakeUpdater extends EventEmitter implements UpdaterLike {
  autoDownload = false
  autoInstallOnAppQuit = false
  allowDowngrade = false
  allowPrerelease = false
  checkForUpdates = vi.fn(async (): Promise<{
    updateInfo: { version: string; releaseNotes?: string; releaseDate?: string }
  } | null> => ({
    updateInfo: { version: '1.0.23', releaseNotes: '修复若干问题', releaseDate: '2026-10-27' }
  }))
  downloadUpdate = vi.fn<(token?: FakeToken) => Promise<void>>(async () => undefined)
  quitAndInstall = vi.fn()
  lastToken: FakeToken | null = null
  setFeedURL = vi.fn()
}

let service: ReturnType<typeof createUpdateService> | null = null

function make(options: Partial<UpdateServiceOptions> = {}) {
  const updater = new FakeUpdater()
  const states: UpdateStateDto[] = []
  const allowClose = vi.fn()
  service = createUpdateService({
    updater,
    currentVersion: '1.0.22',
    packaged: true,
    send: (state) => states.push(state),
    onAllowClose: allowClose,
    ...options
  })
  return { updater, states, allowClose }
}

afterEach(() => {
  service = null
  vi.restoreAllMocks()
})

describe('update version helpers', () => {
  it('normalizes and compares numeric versions without downgrading', () => {
    expect(normalizeVersion('v1.0.23-beta.1')).toBe('1.0.23')
    expect(normalizeVersion('bad')).toBeNull()
    expect(compareVersions('1.0.23', '1.0.22')).toBe(1)
    expect(compareVersions('1.0.22', '1.0.23')).toBe(-1)
    expect(compareVersions('1.0.22', '1.0.22')).toBe(0)
  })
})

describe('update service check', () => {
  it('returns the remote HTTP status as a localizable service error', async () => {
    make({
      resolveFeed: () => resolveRemoteFeed({
        baseUrl: 'https://new.yuwangchenfa.com',
        tenantId: '162',
        currentVersion: '1.0.22',
        platform: 'windows',
        arch: 'x64',
        fetchImpl: async () => new Response('maintenance', { status: 503 })
      })
    })
    const error = { messageKey: 'update.error.service', messageParams: { status: 503 } }
    await expect(service!.check()).resolves.toMatchObject({ status: 'unavailable', ...error })
    expect(service!.getState()).toMatchObject({ state: 'error', ...error })
  })

  it('shares one in-flight check while resolving the update feed', async () => {
    let finishFeed!: (feed: string) => void
    const resolveFeed = vi.fn(() => new Promise<string>((resolve) => { finishFeed = resolve }))
    const { updater } = make({ resolveFeed })
    const first = service!.check()
    const second = service!.check()
    expect(second).toBe(first)
    await Promise.resolve()
    expect(resolveFeed).toHaveBeenCalledOnce()
    finishFeed('https://new.yuwangchenfa.com/updates/')
    await expect(second).resolves.toMatchObject({ status: 'update', latest: '1.0.23' })
    expect(updater.checkForUpdates).toHaveBeenCalledOnce()
    expect(service!.download()).toEqual({ ok: true })
    expect(service!.cancel()).toMatchObject({ ok: true })
  })

  it('reports an available update with notes and release date', async () => {
    const { states } = make()
    const result = await service!.check()
    expect(result).toMatchObject({
      status: 'update',
      current: '1.0.22',
      latest: '1.0.23',
      notes: '修复若干问题',
      releaseDate: '2026-10-27'
    })
    expect(service!.getState().state).toBe('available')
    expect(states.some((state) => state.state === 'checking')).toBe(true)
  })

  it('treats equal or older versions as latest', async () => {
    const { updater } = make()
    updater.checkForUpdates.mockResolvedValue({ updateInfo: { version: '1.0.22' } })
    await expect(service!.check()).resolves.toMatchObject({ status: 'latest', current: '1.0.22' })
    expect(service!.getState().state).toBe('latest')
  })

  it('maps network/feed failures to unavailable and keeps an error state', async () => {
    const { updater } = make()
    updater.checkForUpdates.mockRejectedValue(new Error('network down'))
    const result = await service!.check()
    expect(result).toMatchObject({ status: 'unavailable', message: 'network down', messageKey: 'update.error.network' })
    expect(service!.getState()).toMatchObject({ state: 'error', messageKey: 'update.error.network' })
  })
})

describe('update service download and install', () => {
  it('emits progress and moves to ready after update-downloaded', async () => {
    const { updater, states } = make()
    updater.downloadUpdate.mockImplementation(async (token?: FakeToken) => {
      updater.lastToken = token ?? null
      updater.emit('download-progress', { percent: 50, transferred: 50, total: 100, bytesPerSecond: 1024 })
      updater.emit('update-downloaded', { version: '1.0.23' })
    })
    await service!.check()
    expect(service!.download()).toEqual({ ok: true })
    await Promise.resolve()
    expect(service!.getState()).toMatchObject({
      state: 'ready',
      latest: '1.0.23',
      progress: { percent: 100 }
    })
    expect(states.some((state) => state.state === 'downloading')).toBe(true)
  })

  it('cancels an in-flight download and returns to available', async () => {
    const { updater } = make()
    updater.downloadUpdate.mockImplementation(async (token?: FakeToken) => {
      updater.lastToken = token ?? null
      await new Promise(() => undefined)
    })
    await service!.check()
    service!.download()
    expect(updater.lastToken).not.toBeNull()
    expect(service!.cancel()).toEqual({ ok: true, canceled: true })
    expect(updater.lastToken?.cancelled).toBe(true)
    expect(service!.getState().state).toBe('available')
  })

  it('installs only from ready and allows the main window to close', async () => {
    const { updater, allowClose } = make()
    expect(service!.install()).toMatchObject({ ok: false, messageKey: 'update.error.notReady' })
    updater.downloadUpdate.mockImplementation(async () => {
      updater.emit('update-downloaded', { version: '1.0.23' })
    })
    await service!.check()
    service!.download()
    await Promise.resolve()
    expect(service!.install()).toEqual({ ok: true })
    expect(allowClose).toHaveBeenCalledWith(true)
    expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true)
  })

  it('maps download/checksum failures to an error without ready', async () => {
    const { updater } = make()
    updater.downloadUpdate.mockImplementation(async () => {
      updater.emit('error', new Error('checksum mismatch'))
    })
    await service!.check()
    service!.download()
    await Promise.resolve()
    expect(service!.getState()).toMatchObject({ state: 'error', messageKey: 'update.error.download' })
  })

  it('restores window close protection after the updater emits an installation error', async () => {
    const { updater, allowClose } = make()
    updater.downloadUpdate.mockImplementation(async () => {
      updater.emit('update-downloaded', { version: '1.0.23' })
    })
    await service!.check()
    service!.download()
    expect(service!.getState().state).toBe('ready')
    updater.quitAndInstall.mockImplementationOnce(() => updater.emit('error', new Error('installer unavailable')))
    expect(service!.install()).toEqual({ ok: false, error: 'installer unavailable', messageKey: 'update.error.install' })
    expect(allowClose.mock.calls).toEqual([[true], [false]])
  })
})

describe('update service · 服务端判定更新源（013 / Q89）', () => {
  it('服务端说无更新时，不调用更新器', async () => {
    const { updater } = make({ resolveFeed: async () => null })

    const result = await service!.check()

    expect(result.status).toBe('latest')
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('服务端给了 feed 时，先 setFeedURL 再检查', async () => {
    const feed = 'https://new.yuwangchenfa.com/app-api/software/feed/windows/x64/'
    const { updater } = make({ resolveFeed: async () => feed })

    const result = await service!.check()

    expect(updater.setFeedURL).toHaveBeenLastCalledWith({ provider: 'generic', url: feed })
    expect(updater.checkForUpdates).toHaveBeenCalled()
    expect(result.status).toBe('update')
  })

  it('查询失败时报告不可用，便于手动检查区分故障和无更新', async () => {
    const { updater, states } = make({
      resolveFeed: async () => {
        throw new Error('offline')
      }
    })

    const result = await service!.check()

    expect(result).toMatchObject({ status: 'unavailable', messageKey: 'update.error.network' })
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
    expect(states.at(-1)?.state).toBe('error')
  })
})

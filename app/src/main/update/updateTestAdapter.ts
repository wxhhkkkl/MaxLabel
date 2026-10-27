import { EventEmitter } from 'node:events'
import type { CancellationToken } from 'electron-updater'
import type { UpdaterLike } from './updateTypes'

export const TEST_UPDATE_VERSION = '1.0.99'

/**
 * 仅非打包构建使用的更新测试适配器。
 *
 * 通过 MAXLABEL_TEST_UPDATE 选择模式：
 * - available / progress / ready：有新版本，可下载并走完进度/ready
 * - latest：已是最新
 * - error / 404：检查失败
 * - bad-checksum / download-error：下载/校验失败
 *
 * 它不执行安装器、不退出应用，只用于 e2e/手工 UI 验证。
 */
export class TestUpdater extends EventEmitter implements UpdaterLike {
  autoDownload = false
  autoInstallOnAppQuit = false
  allowDowngrade = false
  allowPrerelease = false

  constructor(private readonly mode: string) {
    super()
  }

  async checkForUpdates(): Promise<{ updateInfo: { version: string; releaseNotes: string; releaseDate: string } } | null> {
    if (this.mode === 'error') throw new Error('测试：网络不可用')
    if (this.mode === '404') throw new Error('测试：更新源返回 404')
    if (this.mode === 'latest') return null
    return {
      updateInfo: {
        version: TEST_UPDATE_VERSION,
        releaseNotes: '测试版本更新说明',
        releaseDate: new Date().toISOString()
      }
    }
  }

  async downloadUpdate(token?: CancellationToken): Promise<void> {
    if (this.mode === 'bad-checksum' || this.mode === 'download-error') {
      this.schedule(() => this.emit('error', new Error('测试：更新包校验失败')), 30)
      return
    }
    const steps = [12, 45, 78, 100]
    steps.forEach((percent, index) => {
      this.schedule(() => {
        if (token?.cancelled) return
        this.emit('download-progress', {
          percent,
          transferred: percent,
          total: 100,
          bytesPerSecond: 2048
        })
      }, 30 + index * 30)
    })
    this.schedule(() => {
      if (token?.cancelled) return
      this.emit('update-downloaded', { version: TEST_UPDATE_VERSION })
    }, 170)
  }

  quitAndInstall(): void {
    // 测试适配器不真正退出；e2e 只断言 install 请求/installing 状态。
  }

  private schedule(run: () => void, delay: number): void {
    setTimeout(run, delay)
  }
}

export function createTestUpdater(mode: string): TestUpdater {
  return new TestUpdater(mode)
}

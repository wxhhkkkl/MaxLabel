// 启动自动检查更新 + 帮助 → 查找更新版本（帮助 install_upgrade.html）
// 覆盖：版本比较、清单解析、清单地址推导、有新版本/已最新/取不到清单三种结果，
// 以及「检查失败必须静默（返回 unavailable 而不是抛错）」。
import assert from 'node:assert'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { checkForUpdate, compareVersions, normalizeVersion, parseVersionManifest, resolveManifestUrl } from '../src/main/updater'

function check(name: string, fn: () => void): void {
  fn()
  console.log(`ok - ${name}`)
}
async function checkAsync(name: string, fn: () => Promise<void>): Promise<void> {
  await fn()
  console.log(`ok - ${name}`)
}

/** 起一个只服务固定响应的本机清单服务器，用完即关。 */
function serveManifest(status: number, body: string): Promise<{ url: string; server: Server; hits: () => number }> {
  let hits = 0
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      hits += 1
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(body)
    })
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({ url: `http://127.0.0.1:${port}`, server, hits: () => hits })
    })
  })
}

async function main(): Promise<void> {
  check('normalizeVersion 去掉 v 前缀与预发布后缀', () => {
    assert.strictEqual(normalizeVersion('v1.2.3'), '1.2.3')
    assert.strictEqual(normalizeVersion('2.0.0-beta.1'), '2.0.0')
    assert.strictEqual(normalizeVersion(' 1.0 '), '1.0')
    assert.strictEqual(normalizeVersion('abc'), null)
    assert.strictEqual(normalizeVersion(''), null)
  })

  check('compareVersions 逐段比较并按缺位补 0', () => {
    assert.strictEqual(compareVersions('1.0.0', '1.0.0'), 0)
    assert.strictEqual(compareVersions('1.0.1', '1.0.0'), 1)
    assert.strictEqual(compareVersions('0.9.9', '1.0.0'), -1)
    assert.strictEqual(compareVersions('1.10', '1.9.9'), 1)
    assert.strictEqual(compareVersions('1.0', '1.0.0'), 0)
    assert.strictEqual(compareVersions('v2.0.0', '1.9.9'), 1)
  })

  check('parseVersionManifest 接受 version/latest 两种字段', () => {
    assert.deepStrictEqual(parseVersionManifest('{"version":"0.2.0"}'), { version: '0.2.0', url: undefined, notes: undefined })
    assert.deepStrictEqual(parseVersionManifest('{"latest":"0.3.0","url":"https://example.com/setup.exe","notes":"修了一批问题"}'), {
      version: '0.3.0',
      url: 'https://example.com/setup.exe',
      notes: '修了一批问题'
    })
    assert.strictEqual(parseVersionManifest('not json'), null)
    assert.strictEqual(parseVersionManifest('{"version":"abc"}'), null)
    assert.strictEqual(parseVersionManifest('{}'), null)
  })

  check('resolveManifestUrl 取云服务器地址下的 /api/version', () => {
    assert.strictEqual(resolveManifestUrl('https://cloud.example.com'), 'https://cloud.example.com/api/version')
    assert.strictEqual(resolveManifestUrl('https://cloud.example.com/', undefined), 'https://cloud.example.com/api/version')
    assert.strictEqual(resolveManifestUrl('http://127.0.0.1:8420'), 'http://127.0.0.1:8420/api/version')
    // 远程 http 与非法地址一律不产生清单地址（沿用 serverUrlPolicy 的口径）
    assert.strictEqual(resolveManifestUrl('http://cloud.example.com'), null)
    assert.strictEqual(resolveManifestUrl('ftp://cloud.example.com'), null)
    assert.strictEqual(resolveManifestUrl(''), null)
    assert.strictEqual(resolveManifestUrl(undefined), null)
    // 显式覆盖（MAXLABEL_UPDATE_URL 场景）优先
    assert.strictEqual(resolveManifestUrl(undefined, 'https://cdn.example.com/version.json'), 'https://cdn.example.com/version.json')
  })

  await checkAsync('有新版本 → status=update，带下载地址与更新说明', async () => {
    const { url, server } = await serveManifest(200, '{"version":"9.9.9","url":"https://example.com/setup.exe","notes":"新版本"}')
    try {
      const result = await checkForUpdate({ currentVersion: '0.1.0', serverUrl: url })
      assert.strictEqual(result.status, 'update')
      assert.strictEqual(result.current, '0.1.0')
      assert.strictEqual(result.latest, '9.9.9')
      assert.strictEqual(result.url, 'https://example.com/setup.exe')
      assert.strictEqual(result.notes, '新版本')
    } finally {
      server.close()
    }
  })

  await checkAsync('版本不高于当前 → status=latest', async () => {
    for (const body of ['{"version":"0.1.0"}', '{"version":"0.0.9"}']) {
      const { url, server } = await serveManifest(200, body)
      try {
        const result = await checkForUpdate({ currentVersion: '0.1.0', serverUrl: url })
        assert.strictEqual(result.status, 'latest', body)
        assert.strictEqual(result.current, '0.1.0')
      } finally {
        server.close()
      }
    }
  })

  await checkAsync('未配置服务器地址 → unavailable（启动路径静默）', async () => {
    const result = await checkForUpdate({ currentVersion: '0.1.0', serverUrl: '' })
    assert.strictEqual(result.status, 'unavailable')
    assert.ok(result.message && result.message.includes('未配置云服务器地址'))
  })

  await checkAsync('连不上服务器 → unavailable，不抛错', async () => {
    // 1 端口不会有人监听；整条路径必须收敛成 unavailable
    const result = await checkForUpdate({ currentVersion: '0.1.0', serverUrl: 'http://127.0.0.1:1', timeoutMs: 800 })
    assert.strictEqual(result.status, 'unavailable')
    assert.ok(result.message && result.message.includes('无法连接更新服务器'))
  })

  await checkAsync('清单返回非 200 或内容不可识别 → unavailable', async () => {
    const bad = await serveManifest(500, 'oops')
    try {
      const result = await checkForUpdate({ currentVersion: '0.1.0', serverUrl: bad.url })
      assert.strictEqual(result.status, 'unavailable')
      assert.ok(result.message && result.message.includes('500'))
    } finally {
      bad.server.close()
    }
    const garbage = await serveManifest(200, '<html>no manifest</html>')
    try {
      const result = await checkForUpdate({ currentVersion: '0.1.0', serverUrl: garbage.url })
      assert.strictEqual(result.status, 'unavailable')
      assert.ok(result.message && result.message.includes('无法识别'))
    } finally {
      garbage.server.close()
    }
  })

  await checkAsync('清单地址指向 /api/version，且每次检查只发一次请求', async () => {
    const { url, server, hits } = await serveManifest(200, '{"version":"1.0.0"}')
    try {
      await checkForUpdate({ currentVersion: '0.1.0', serverUrl: url })
      assert.strictEqual(hits(), 1)
    } finally {
      server.close()
    }
  })

  console.log('update check checks passed')
}

void main()

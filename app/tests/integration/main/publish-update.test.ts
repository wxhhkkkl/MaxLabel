import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

it('publishes the legacy installer URL only for a checksummed manifest entry', () => {
  const root = mkdtempSync(join(tmpdir(), 'maxlabel-publish-test-'))
  const release = join(root, 'release')
  const target = join(root, 'staging')
  const script = fileURLToPath(new URL('../../../scripts/publish-update.cjs', import.meta.url))
  const file = 'windows/installer#signed.exe'
  const content = Buffer.from('verified installer')
  const hash = createHash('sha512').update(content).digest('base64')
  const feed = 'https://updates.example.com/test/'
  const publish = (path: string, sha512 = hash) => {
    writeFileSync(join(release, 'latest.yml'), JSON.stringify({
      version: '1.2.3', path, sha512, files: [{ url: file, size: content.length, sha512: hash }]
    }))
    return spawnSync(process.execPath, [script, '--release', release, '--target-dir', target, '--feed', feed], { encoding: 'utf8' })
  }
  try {
    mkdirSync(dirname(join(release, file)), { recursive: true })
    writeFileSync(join(release, file), content)
    writeFileSync(join(release, 'stale.exe'), 'unverified installer')
    expect(publish('stale.exe').status).toBe(1)
    expect(publish(file, 'wrong-hash').status).toBe(1)
    expect(existsSync(join(target, 'version.json'))).toBe(false)

    const result = publish(file)
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(readFileSync(join(target, 'version.json'), 'utf8'))).toMatchObject({ url: feed + 'windows/installer%23signed.exe' })
    expect(readFileSync(join(target, file))).toEqual(content)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

it('preserves the entire previous staging snapshot when another platform fails validation', () => {
  const root = mkdtempSync(join(tmpdir(), 'maxlabel-publish-replace-'))
  const release = join(root, 'release')
  const target = join(root, 'staging')
  const script = fileURLToPath(new URL('../../../scripts/publish-update.cjs', import.meta.url))
  const installer = 'setup.exe'
  const manifest = (name: string, artifact: string, version: string, contents: string) => {
    const bytes = Buffer.from(contents)
    writeFileSync(join(release, artifact), bytes)
    writeFileSync(join(release, name), JSON.stringify({
      version, files: [{ url: artifact, size: bytes.length, sha512: createHash('sha512').update(bytes).digest('base64') }]
    }))
  }
  const publish = () => spawnSync(process.execPath, [script, '--release', release, '--target-dir', target], { encoding: 'utf8' })
  try {
    mkdirSync(release)
    manifest('latest.yml', installer, '1.2.3', 'old installer')
    expect(publish().status).toBe(0)
    const snapshot = () => Object.fromEntries(readdirSync(target).map((name) => [name, readFileSync(join(target, name), 'utf8')]))
    const previous = snapshot()

    manifest('latest.yml', installer, '1.2.4', 'new installer')
    writeFileSync(join(release, 'latest-mac.yml'), '{"version":"1.2.4"}')
    expect(publish().status).toBe(1)
    expect(snapshot()).toEqual(previous)
    expect(readdirSync(root).sort()).toEqual(['release', 'staging'])

    manifest('latest-mac.yml', 'setup.zip', '1.2.4', 'new zip')
    expect(publish().status).toBe(0)
    expect(readFileSync(join(target, installer), 'utf8')).toBe('new installer')
    expect(JSON.parse(readFileSync(join(target, 'version.json'), 'utf8')).version).toBe('1.2.4')
    expect(readFileSync(join(target, 'setup.zip'), 'utf8')).toBe('new zip')
  } finally {
    if (root.startsWith(join(tmpdir(), 'maxlabel-publish-replace-'))) rmSync(root, { recursive: true, force: true })
  }
})

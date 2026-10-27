/**
 * 更新源发布前校验 / 暂存脚本。
 *
 * 用法：
 *   node scripts/publish-update.cjs --release release --target-dir release/updates-staging \
 *     --feed https://new.yuwangchenfa.com/updates-staging/
 *
 * 它不直接持有服务器凭据：校验通过后把 latest*.yml、安装包、blockmap 与旧版
 * `/api/version` 迁移 JSON 暂存到 target-dir，再由既有发布流程上传到 feed。
 */
const { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } = require('node:fs')
const { createHash } = require('node:crypto')
const { basename, join, resolve } = require('node:path')
const yaml = require('js-yaml')

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

const releaseDir = resolve(arg('release', 'release'))
const targetDir = resolve(arg('target-dir', join(releaseDir, 'updates-staging')))
const feed = String(arg('feed', 'https://new.yuwangchenfa.com/updates/')).replace(/\/?$/, '/')

function fail(message) {
  console.error(`[publish-update] ${message}`)
  process.exit(1)
}

function sha512(file) {
  return createHash('sha512').update(readFileSync(file)).digest('base64')
}

function validateRelative(value, label) {
  const text = String(value ?? '').trim()
  if (!text || /^[a-z]+:/i.test(text) || text.includes('..') || text.includes('\\')) {
    fail(`${label} 必须是更新目录内的相对路径：${text}`)
  }
  return text
}

if (!existsSync(releaseDir)) fail(`找不到 release 目录：${releaseDir}`)

const manifests = ['latest.yml', 'latest-mac.yml', 'latest-linux.yml']
  .map((name) => ({ name, path: join(releaseDir, name) }))
  .filter((entry) => existsSync(entry.path))
if (manifests.length === 0) fail('release 目录里没有 latest*.yml，请先构建并确认 build.publish 配置')

mkdirSync(targetDir, { recursive: true })
const copied = new Set()
let windowsVersion = null

for (const manifest of manifests) {
  let parsed
  try {
    parsed = yaml.load(readFileSync(manifest.path, 'utf8'))
  } catch (error) {
    fail(`解析 ${manifest.name} 失败：${error.message}`)
  }
  if (!parsed || typeof parsed !== 'object') fail(`${manifest.name} 内容无效`)
  const version = String(parsed.version ?? '').trim()
  if (!/^\d+(\.\d+)*$/.test(version)) fail(`${manifest.name} 的 version 无效：${version}`)
  const files = Array.isArray(parsed.files) ? parsed.files : []
  if (files.length === 0) fail(`${manifest.name} 缺少 files[]`)
  for (const file of files) {
    const relative = validateRelative(file.url, `${manifest.name} files[].url`)
    const local = join(releaseDir, relative)
    if (!existsSync(local)) fail(`${manifest.name} 引用的文件不存在：${relative}`)
    const size = statSync(local).size
    if (Number(file.size) !== size) fail(`${relative} 大小不匹配：manifest ${file.size} / 实际 ${size}`)
    if (String(file.sha512 ?? '') !== sha512(local)) fail(`${relative} SHA-512 不匹配`)
    copyFileSync(local, join(targetDir, basename(relative)))
    copied.add(basename(relative))
    const blockmap = `${local}.blockmap`
    if (existsSync(blockmap)) {
      copyFileSync(blockmap, join(targetDir, basename(blockmap)))
      copied.add(basename(blockmap))
    }
  }
  if (parsed.path) {
    const relative = validateRelative(parsed.path, `${manifest.name} path`)
    const local = join(releaseDir, relative)
    if (!existsSync(local)) fail(`${manifest.name} path 指向的文件不存在：${relative}`)
    if (!copied.has(basename(relative))) {
      copyFileSync(local, join(targetDir, basename(relative)))
      copied.add(basename(relative))
    }
    const blockmap = `${local}.blockmap`
    if (existsSync(blockmap) && !copied.has(basename(blockmap))) {
      copyFileSync(blockmap, join(targetDir, basename(blockmap)))
      copied.add(basename(blockmap))
    }
  }
  copyFileSync(manifest.path, join(targetDir, basename(manifest.name)))
  copied.add(manifest.name)
  if (manifest.name === 'latest.yml') windowsVersion = { version, path: validateRelative(parsed.path ?? files[0].url, 'latest.yml path'), notes: parsed.releaseNotes ?? '' }
}

if (windowsVersion) {
  const legacy = {
    version: windowsVersion.version,
    url: `${feed}${windowsVersion.path}`,
    notes: typeof windowsVersion.notes === 'string' ? windowsVersion.notes : ''
  }
  const legacyPath = join(targetDir, 'version.json')
  require('node:fs').writeFileSync(legacyPath, JSON.stringify(legacy, null, 2), 'utf8')
  copied.add('version.json')
}

console.log(`[publish-update] 校验通过，${manifests.length} 个 manifest、${copied.size} 个文件已暂存到 ${targetDir}`)
console.log(`[publish-update] 请把该目录内容上传到 ${feed}`)
if (windowsVersion) console.log(`[publish-update] 旧版迁移入口：${feed}version.json（部署为 /api/version）`)

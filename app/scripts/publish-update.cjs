/**
 * 校验所有平台的更新清单和安装包，再整体替换本地发布暂存目录。
 *
 * 用法：
 *   node scripts/publish-update.cjs --release release --target-dir release/updates-staging \
 *     --feed https://new.yuwangchenfa.com/updates-staging/
 *
 * target-dir 是本脚本生成的独立暂存目录。上传仍使用现有发布流程。
 */
const {
  constants, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync,
  readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync
} = require('node:fs')
const { createHash } = require('node:crypto')
const { dirname, isAbsolute, join, relative, resolve, sep } = require('node:path')
const yaml = require('js-yaml')

function arg(name, fallback) {
  const index = process.argv.indexOf('--' + name)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

const releaseDir = resolve(arg('release', 'release'))
const targetDir = resolve(arg('target-dir', join(releaseDir, 'updates-staging')))
const feed = String(arg('feed', 'https://new.yuwangchenfa.com/updates/')).replace(/\/?$/, '/')

function fail(message) {
  throw new Error(message)
}

function sha512(file) {
  return createHash('sha512').update(readFileSync(file)).digest('base64')
}

function validateRelative(value, label) {
  const text = String(value ?? '').trim()
  if (!text || text.startsWith('/') || /^[a-z]+:/i.test(text) || text.includes('..') || text.includes('\\')) {
    fail(label + ' 必须是更新目录内的相对路径：' + text)
  }
  return text
}

function stageUpdate(candidate, manifests) {
  const copied = new Set()
  let windowsVersion = null
  for (const name of manifests) {
    const text = readFileSync(join(releaseDir, name), 'utf8')
    let parsed
    try {
      parsed = yaml.load(text)
    } catch (error) {
      fail('解析 ' + name + ' 失败：' + error.message)
    }
    if (!parsed || typeof parsed !== 'object') fail(name + ' 内容无效')
    const version = String(parsed.version ?? '').trim()
    if (!/^\d+(\.\d+)*$/.test(version)) fail(name + ' 的 version 无效：' + version)
    const files = Array.isArray(parsed.files) ? parsed.files : []
    if (!files.length) fail(name + ' 缺少 files[]')
    const legacyPath = parsed.path == null ? null : validateRelative(parsed.path, name + ' path')
    const legacyFile = legacyPath === null ? undefined : files.find((file) => file?.url === legacyPath)
    if (legacyPath !== null && !legacyFile) {
      fail(name + ' path 必须指向 files[] 中已校验的安装包：' + legacyPath)
    }
    if (legacyFile && parsed.sha512 != null && parsed.sha512 !== legacyFile.sha512) {
      fail(name + ' 的旧版 SHA-512 与 files[] 不一致：' + legacyPath)
    }
    for (const file of files) {
      const artifact = validateRelative(file.url, name + ' files[].url')
      const local = join(releaseDir, artifact)
      const destination = join(candidate, artifact)
      if (!copied.has(artifact)) {
        if (!existsSync(local)) fail(name + ' 引用的文件不存在：' + artifact)
        mkdirSync(dirname(destination), { recursive: true })
        copyFileSync(local, destination, constants.COPYFILE_EXCL)
        copied.add(artifact)
      }
      const size = statSync(destination).size
      if (Number(file.size) !== size) fail(artifact + ' 大小不匹配：manifest ' + file.size + ' / 实际 ' + size)
      if (String(file.sha512 ?? '') !== sha512(destination)) fail(artifact + ' SHA-512 不匹配')
      if (!copied.has(artifact + '.blockmap') && existsSync(local + '.blockmap')) {
        copyFileSync(local + '.blockmap', destination + '.blockmap', constants.COPYFILE_EXCL)
        copied.add(artifact + '.blockmap')
      }
    }
    writeFileSync(join(candidate, name), text, { encoding: 'utf8', flag: 'wx' })
    copied.add(name)
    if (name === 'latest.yml') {
      windowsVersion = { version, path: legacyPath ?? validateRelative(files[0].url, name + ' path'), notes: parsed.releaseNotes ?? '' }
    }
  }
  if (windowsVersion) {
    const legacy = {
      version: windowsVersion.version,
      url: feed + windowsVersion.path.split('/').map(encodeURIComponent).join('/'),
      notes: typeof windowsVersion.notes === 'string' ? windowsVersion.notes : ''
    }
    writeFileSync(join(candidate, 'version.json'), JSON.stringify(legacy, null, 2), { encoding: 'utf8', flag: 'wx' })
    copied.add('version.json')
  }
  return copied
}

function replaceStaging(candidate, backup) {
  if (existsSync(targetDir)) {
    if (!lstatSync(targetDir).isDirectory()) fail('暂存目标必须为普通目录：' + targetDir)
    renameSync(targetDir, backup)
  }
  try {
    renameSync(candidate, targetDir)
  } catch (error) {
    if (existsSync(backup)) {
      try { renameSync(backup, targetDir) } catch {
        fail('无法恢复原暂存目录，备份保存在 ' + backup + '：' + error.message)
      }
    }
    throw error
  }
}

function run() {
  if (!existsSync(releaseDir)) fail('找不到 release 目录：' + releaseDir)
  const sourceFromTarget = relative(existsSync(targetDir) ? realpathSync(targetDir) : targetDir, realpathSync(releaseDir))
  if (!sourceFromTarget || (!isAbsolute(sourceFromTarget) && sourceFromTarget !== '..' && !sourceFromTarget.startsWith('..' + sep))) {
    fail('暂存目录不能包含构建产物源目录：' + targetDir)
  }
  const manifests = ['latest.yml', 'latest-mac.yml', 'latest-linux.yml'].filter((name) => existsSync(join(releaseDir, name)))
  if (!manifests.length) fail('release 目录里没有 latest*.yml，请先构建并确认 build.publish 配置')

  const parent = dirname(targetDir)
  mkdirSync(parent, { recursive: true })
  const work = mkdtempSync(join(parent, '.maxlabel-updates-'))
  const candidate = join(work, 'candidate')
  const backup = join(work, 'previous')
  let committed = false
  let files
  try {
    mkdirSync(candidate)
    files = stageUpdate(candidate, manifests)
    replaceStaging(candidate, backup)
    committed = true
  } finally {
    if (committed || !existsSync(backup)) {
      try { rmSync(work, { recursive: true, force: true }) }
      catch (error) { console.warn('[publish-update] 清理临时目录失败：' + error.message) }
    }
  }
  console.log('[publish-update] 校验通过，' + manifests.length + ' 个 manifest、' + files.size + ' 个文件已暂存到 ' + targetDir)
  console.log('[publish-update] 请把该目录内容上传到 ' + feed)
  if (files.has('version.json')) console.log('[publish-update] 旧版迁移入口：' + feed + 'version.json（部署为 /api/version）')
}

try { run() } catch (error) {
  console.error('[publish-update] ' + error.message)
  process.exitCode = 1
}

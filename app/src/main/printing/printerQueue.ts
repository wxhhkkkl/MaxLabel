import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { usbPortName } from '../../shared/domain/printer'

const execFileAsync = promisify(execFile)

export interface PrinterQueueResult {
  ok: boolean
  queueName?: string
  created?: boolean
  message?: string
}

export interface PowerShellResult {
  ok: boolean
  stdout: string
  stderr: string
}

export type PowerShellRunner = (script: string) => Promise<PowerShellResult>

async function runPowerShell(script: string): Promise<PowerShellResult> {
  try {
    const { stdout, stderr } = await execFileAsync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command', script
    ], { timeout: 60000, windowsHide: true, maxBuffer: 1024 * 1024 })
    return { ok: true, stdout: String(stdout), stderr: String(stderr) }
  } catch (error) {
    return {
      ok: false,
      stdout: String((error as { stdout?: unknown }).stdout ?? ''),
      stderr: String((error as { stderr?: unknown }).stderr
        ?? (error as { message?: unknown }).message
        ?? error)
    }
  }
}

export function normalizeUsbPort(value: unknown): string {
  // 安装流程传入的是真机格式 `USB002 (HPRTT310)`；队列命令只接受 USB002。
  const port = usbPortName(String(value ?? '')).toUpperCase()
  if (!/^USB\d+$/.test(port)) throw new Error('USB 端口名无效')
  return port
}

/**
 * 应用为 USB 直连创建的队列名（安装时用 Generic / Text Only 建），只是把原始指令
 * 送进 USB 端口的内部通道；它不该出现在「Windows 打印机」列表里（用户应选「直连打印机」项）。
 */
export function isManagedQueueName(name: string): boolean {
  return /^MaxLabel .+\(USB\d+\)$/i.test(String(name ?? '').trim())
}

/** 队列名只用于 Windows 队列显示；真正打印时按端口找队列，不依赖这个名字。 */
export function queueNameFor(port: string, hint: string): string {
  const clean = String(hint ?? '')
    .replace(/[\\/:*?"<>|\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
  return `MaxLabel ${clean || 'Generic'} (${port})`.slice(0, 80)
}

function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function parseCreateOutput(stdout: string): { ok: boolean; queueName?: string; message?: string } {
  const ok = /OK:(.+)/.exec(stdout)
  if (ok) return { ok: true, queueName: ok[1].trim().split(/\r?\n/)[0] }
  const error = /ERR:(.+)/.exec(stdout)
  if (error) return { ok: false, message: error[1].trim().split(/\r?\n/)[0] }
  return { ok: false, message: stdout.trim() || '创建 Windows 打印队列失败' }
}

function queryScript(port: string): string {
  return [
    "$ErrorActionPreference='Stop'",
    `$port = ${psQuote(port)}`,
    "$queue = @(Get-WmiObject Win32_Printer | Where-Object { $_.PortName -eq $port } | Select-Object -First 1)",
    "if ($queue) { Write-Output ('EXISTS:' + $queue[0].Name) } else { Write-Output 'NONE' }"
  ].join('\n')
}

function createScript(port: string, baseName: string, resultFile: string): string {
  return [
    "$ErrorActionPreference='Stop'",
    `$port = ${psQuote(port)}`,
    `$base = ${psQuote(baseName)}`,
    `$result = ${psQuote(resultFile)}`,
    "$out = ''",
    'try {',
    "  $queue = @(Get-WmiObject Win32_Printer | Where-Object { $_.PortName -eq $port } | Select-Object -First 1)",
    "  if (-not $queue) {",
    '    $name = $base',
    '    $i = 2',
    '    while (@(Get-WmiObject Win32_Printer | Where-Object { $_.Name -eq $name }).Count -gt 0) { $name = "$base $i"; $i++ }',
    "    $inf = Join-Path $env:windir 'inf\prnge001.inf'",
    "    if (-not (Test-Path $inf)) { throw '找不到 Generic / Text Only 驱动 inf' }",
    "    $drivers = @('Generic / Text Only', '通用 / 仅文本')",
    '    foreach ($driver in $drivers) {',
    '      & "$env:windir\System32\rundll32.exe" printui.dll,PrintUIEntry /if /b $name /f $inf /r $port /m $driver /q',
    "      $queue = @(Get-WmiObject Win32_Printer | Where-Object { $_.PortName -eq $port } | Select-Object -First 1)",
    '      if ($queue) { break }',
    '    }',
    '  }',
    "  if (-not $queue) { throw '创建后仍未找到该端口的打印队列' }",
    "  $out = 'OK:' + $queue[0].Name",
    '} catch {',
    "  $out = 'ERR:' + $_.Exception.Message",
    '}',
    'Set-Content -Path $result -Value $out -Encoding UTF8',
    'Write-Output $out'
  ].join('\n')
}

async function runElevated(script: string, resultFile: string, run: PowerShellRunner): Promise<{ ok: boolean; output: string }> {
  const scriptFile = join(tmpdir(), `maxlabel-queue-${randomUUID()}.ps1`)
  await writeFile(scriptFile, script, 'utf8')
  const startScript = [
    "$ErrorActionPreference='Stop'",
    "Start-Process -FilePath 'powershell.exe' -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList @(" +
      "'-NoProfile','-ExecutionPolicy','Bypass','-File'," + psQuote(scriptFile) + ')'
  ].join('\n')
  const result = await run(startScript)
  if (!result.ok) {
    return { ok: false, output: result.stderr || result.stdout || '创建 Windows 打印队列需要管理员权限，操作已取消' }
  }
  try {
    const output = await readFile(resultFile, 'utf8').catch(() => '')
    return { ok: true, output: output.trim() }
  } finally {
    await rm(scriptFile, { force: true }).catch(() => undefined)
  }
}

/**
 * 确保 USB 端口上存在 Windows 打印队列。
 *
 * 原版在“安装打印机”时会准备好队列；复刻版之前只加入软件条目，导致 USB 打印
 * 在 spooler 里找不到队列。这里优先复用端口上的已有队列，没有则用 Windows
 * 自带的 Generic / Text Only 驱动建一个；无权限时通过 UAC 提权重试。
 */
export async function ensureWindowsPrinterQueue(
  portValue: unknown,
  queueHint: string,
  run: PowerShellRunner = runPowerShell
): Promise<PrinterQueueResult> {
  if (process.platform !== 'win32') return { ok: false, message: '仅 Windows 支持创建 USB 打印队列' }
  const port = normalizeUsbPort(portValue)
  const query = await run(queryScript(port))
  if (query.ok) {
    const existing = /EXISTS:(.+)/.exec(query.stdout)
    if (existing) return { ok: true, queueName: existing[1].trim(), created: false }
  }

  const baseName = queueNameFor(port, queueHint)
  const resultFile = join(tmpdir(), `maxlabel-queue-${randomUUID()}.txt`)
  const script = createScript(port, baseName, resultFile)
  const direct = await run(script)
  let parsed = parseCreateOutput(direct.stdout || direct.stderr)
  if (parsed.ok) {
    await rm(resultFile, { force: true }).catch(() => undefined)
    return { ok: true, queueName: parsed.queueName, created: true }
  }

  const elevated = await runElevated(script, resultFile, run)
  if (elevated.ok) parsed = parseCreateOutput(elevated.output)
  await rm(resultFile, { force: true }).catch(() => undefined)
  if (parsed.ok) return { ok: true, queueName: parsed.queueName, created: true }

  return {
    ok: false,
    message: parsed.message || elevated.output || '创建 Windows 打印队列失败，请安装厂商驱动或改用串口/指令文件端口'
  }
}

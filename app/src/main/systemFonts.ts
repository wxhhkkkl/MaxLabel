import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/**
 * GDI 枚举本机字体族。
 * 必须先切 UTF-8 输出，否则 PowerShell 按控制台代码页（zh-CN 是 936）写出的中文名
 * 会被 Node 当作 UTF-8 解码成乱码。
 */
const SCRIPT = [
  '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8',
  'Add-Type -AssemblyName System.Drawing',
  '[System.Drawing.FontFamily]::Families | ForEach-Object { $_.Name }'
].join('; ')

let cache: string[] | null = null

/** 把 PowerShell 的多行输出拆成字族名（去掉空行与首尾空白）。 */
export function parseFontFamilies(stdout: string): string[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

/** 本机安装的字体族名（按进程缓存）。非 Windows 或枚举失败时返回空数组。 */
export async function listSystemFontFamilies(): Promise<string[]> {
  if (process.platform !== 'win32') return []
  if (cache) return cache
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', SCRIPT], {
    timeout: 20000,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024
  })
  cache = parseFontFamilies(stdout)
  return cache
}

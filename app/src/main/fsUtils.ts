import { existsSync } from 'fs'
import { mkdir } from 'fs/promises'

/**
 * 确保目录存在。
 *
 * 不能直接 `mkdir(dir, { recursive: true })`：Windows 上对**盘符根目录**（如 `D:\`）
 * 即使目录已存在也会抛 `EPERM: operation not permitted`，导致「保存到 D 盘根目录」直接失败。
 * 先判断存在性，已存在就不再调用 mkdir。
 */
export async function ensureDirectory(directory: string): Promise<void> {
  if (existsSync(directory)) return
  await mkdir(directory, { recursive: true })
}

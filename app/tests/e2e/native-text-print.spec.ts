import { resolve } from 'node:path'
import { buildSync } from 'esbuild'
import { expect, test } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'
import type { run as runNativeTextCommand } from './harness/native-text-command'

// GDI 文本光栅化仅 Windows 提供；其他平台由渲染层回退 Skia（这里也跳过）。
const windowsOnly = process.platform === 'win32' ? test : test.skip

const payload = {
  text: '本品为初级农产品',
  fontFamily: 'Arial',
  fontSizePt: 6,
  dpi: 203,
  boxWidthPx: 480,
  wrap: true,
  textAlign: 'left',
  lineHeightFactor: 1.16,
  bold: false,
  italic: false,
  underline: false,
  strikeout: false
}

windowsOnly('GDI 文本位图经 IPC 返回可用的单色数据', async () => {
  test.setTimeout(60_000)
  const launched = await launchApp()
  try {
    const result = await launched.window.evaluate(
      (request) => (window as unknown as {
        maxlabel: { nativeTextRasterize: (p: unknown) => Promise<{ ok: boolean; width?: number; height?: number; bytes?: string; message?: string }> }
      }).maxlabel.nativeTextRasterize(request),
      payload
    )
    expect(result.ok).toBe(true)
    expect(result.width ?? 0).toBeGreaterThan(0)
    expect(result.height ?? 0).toBeGreaterThanOrEqual(17)
    expect((result.bytes ?? '').length).toBeGreaterThan(0)
  } finally {
    await launched.close()
  }
})

windowsOnly('指令打印路径（命令模式）的中文文本位图来自真实 GDI', async () => {
  test.setTimeout(90_000)
  const code = buildSync({
    entryPoints: [resolve(__dirname, 'harness/native-text-command.ts')],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    globalName: 'nativeTextCommand',
    write: false,
    target: 'es2022'
  }).outputFiles[0].text
  const launched = await launchApp()
  try {
    // 小字清晰打印默认关闭，这里在真实主窗口里打开系统设置中的开关。
    await launched.window.evaluate(() => localStorage.setItem('maxlabel.options', JSON.stringify({ gdiText: true })))
    const result = await launched.window.evaluate<Awaited<ReturnType<typeof runNativeTextCommand>>>(
      `${code}\nnativeTextCommand.run()`
    )
    // 8 个 6pt 汉字 @203dpi：宽约 144px、高 ≥17px，墨迹比例落在合理区间。
    expect(result.width).toBeGreaterThan(100)
    expect(result.height).toBeGreaterThanOrEqual(17)
    const ratio = result.ink / (result.width * result.height)
    expect(ratio).toBeGreaterThan(0.02)
    expect(ratio).toBeLessThan(0.7)
    expect(result.originXMm).toBeCloseTo(2, 1)
    // 编辑画布：同一段文字用矢量复刻 GDI 版式，字号 = GDI ppem(16px@203dpi=2.0mm) × 10px/mm ≈ 20px
    expect(result.editorType).toBe('text')
    expect(result.editorFontSize).toBeGreaterThan(19)
    expect(result.editorFontSize).toBeLessThan(21)
    expect(result.editorFontFace).toMatch(/黑体|simhei/i)
    expect(result.dateHasBitmap).toBe(true)
    expect(result.dateFontSize).toBeCloseTo(result.editorFontSize)
    expect(result.nativeFontCommand).toMatch(/^TEXT \d+,\d+,"2",.*"BATCH 123"$/)
    expect(result.warnings).toContain('部分小字的 GDI 渲染失败，已使用普通渲染')
  } finally {
    await launched.close()
  }
})

windowsOnly('非法载荷被主进程拒绝且不抛错', async () => {
  test.setTimeout(60_000)
  const launched = await launchApp()
  try {
    const result = await launched.window.evaluate(
      (request) => (window as unknown as {
        maxlabel: { nativeTextRasterize: (p: unknown) => Promise<{ ok: boolean; message?: string }> }
      }).maxlabel.nativeTextRasterize(request),
      { ...payload, text: 'x'.repeat(5000) }
    )
    expect(result.ok).toBe(false)
    expect(result.message).toBeTruthy()
  } finally {
    await launched.close()
  }
})

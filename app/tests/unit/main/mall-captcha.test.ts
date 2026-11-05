import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearMallCaptcha, rememberMallCaptcha, takeMallCaptchaSecret } from '@main/mallCaptcha'

afterEach(() => {
  clearMallCaptcha()
  vi.useRealTimers()
})

describe('mall captcha secrets', () => {
  it('lets each slider proof be used exactly once', () => {
    rememberMallCaptcha('t1', 'secret-1')
    expect(takeMallCaptchaSecret('t1')).toBe('secret-1')
    expect(takeMallCaptchaSecret('t1')).toBeNull()
  })

  it('expires an unused slider proof after two minutes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    rememberMallCaptcha('t1', 'secret-1')
    vi.advanceTimersByTime(2 * 60 * 1000)
    expect(takeMallCaptchaSecret('t1')).toBeNull()
  })
})

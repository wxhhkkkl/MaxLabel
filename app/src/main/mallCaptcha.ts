/** 滑块验证码的一次性 secretKey：只留在主进程，渲染层只拿到验证码图片与 token。 */
const CAPTCHA_TTL_MS = 2 * 60 * 1000

interface PendingCaptcha {
  secretKey: string
  expiresAt: number
}

const pending = new Map<string, PendingCaptcha>()

function prune(now = Date.now()): void {
  for (const [token, entry] of pending) {
    if (entry.expiresAt <= now) pending.delete(token)
  }
}

export function rememberMallCaptcha(token: string, secretKey: string): void {
  prune()
  pending.set(token, { secretKey, expiresAt: Date.now() + CAPTCHA_TTL_MS })
}

/** 取出即作废：一次滑块只能用于一次发送短信请求。 */
export function takeMallCaptchaSecret(token: string): string | null {
  prune()
  const entry = pending.get(token)
  if (!entry) return null
  pending.delete(token)
  return entry.secretKey
}

export function clearMallCaptcha(): void {
  pending.clear()
}

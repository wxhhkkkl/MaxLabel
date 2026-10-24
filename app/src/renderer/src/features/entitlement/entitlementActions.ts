import { FIXED_MALL_ORIGIN, MALL_PURCHASE_PATH, MALL_TENANT_ID } from '../../../../shared/config'

const context = { baseUrl: FIXED_MALL_ORIGIN, tenantId: MALL_TENANT_ID }

/** 从受限对话框直接打开商城购买/续费页。 */
export async function openMembershipPurchase(onError?: (message: string) => void): Promise<void> {
  try {
    const result = await window.maxlabel.mall.open(context, MALL_PURCHASE_PATH)
    if (!result.ok) onError?.(result.error || '无法打开商城')
  } catch (error) {
    onError?.((error as { message?: string })?.message || String(error))
  }
}

/** 从受限对话框打开商城登录窗口；主进程会在登录成功后刷新授权状态。 */
export async function openMembershipLogin(onError?: (message: string) => void): Promise<void> {
  try {
    const result = await window.maxlabel.mall.login(context)
    if (!result.ok) onError?.(result.error || '登录失败')
  } catch (error) {
    onError?.((error as { message?: string })?.message || String(error))
  }
}

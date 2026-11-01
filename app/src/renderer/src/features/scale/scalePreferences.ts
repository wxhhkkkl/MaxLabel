import {
  DEFAULT_SCALE_SETTINGS,
  normalizeScaleSettings,
  type ScaleSettings
} from '../../../../shared/scale/settings'

export const SCALE_SETTINGS_STORAGE_KEY = 'maxlabel.scaleSettings'

/** 读全局电子称设置；存档缺失或损坏一律回默认（设置坏了不该让打印整条链路失败）。 */
export function readScaleSettings(): ScaleSettings {
  try {
    const raw = localStorage.getItem(SCALE_SETTINGS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SCALE_SETTINGS }
    return normalizeScaleSettings(JSON.parse(raw) as unknown)
  } catch {
    return { ...DEFAULT_SCALE_SETTINGS }
  }
}

/** 写入前再归一化一次：调用方传进来的可能是半成品表单。 */
export function writeScaleSettings(settings: ScaleSettings): void {
  try {
    localStorage.setItem(SCALE_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeScaleSettings(settings)))
  } catch {
    // 偏好是可选能力，写失败不影响当前任务。
  }
}

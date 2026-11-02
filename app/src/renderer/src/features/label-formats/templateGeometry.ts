import type { LabelDoc } from '../../../../shared/domain'
import type { PaperGeometry } from '../../../../shared/domain/paper'
import type { ModalKind } from '../shell/modalTypes'

/**
 * “标签格式设置”：打开同一套格式设置对话框，但确认后修改**当前标签**的几何，
 * 不新建文档（新建标签走工具栏「新建标签模版」/启动页）。
 */
export const LABEL_FORMAT_SETTINGS_MODAL: ModalKind = 'labelFormat'

/** Preset formats keep page/label/shape/hole fields read-only. */
export function geometryEditable(formatKind: LabelDoc['formatKind']): boolean {
  return formatKind !== 'preset'
}

/** Build the shared paper geometry from a document layout, defaulting to a rectangle. */
export function paperFromLayout(layout: LabelDoc['layout']): PaperGeometry {
  return {
    shape: layout?.shape ?? 'rect',
    ...(layout?.cornerRadiusMm === undefined ? {} : { cornerRadiusMm: layout.cornerRadiusMm }),
    ...(layout?.innerDiameterMm === undefined ? {} : { innerDiameterMm: layout.innerDiameterMm }),
    ...(layout?.innerShape === undefined ? {} : { innerShape: layout.innerShape }),
    ...(layout?.labelColor === undefined ? {} : { labelColor: layout.labelColor })
  }
}

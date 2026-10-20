import type { LabelDoc } from '../../../../shared/domain'
import type { PaperGeometry } from '../../../../shared/domain/paper'
import type { ModalKind } from '../shell/modalTypes'

/**
 * “标签格式设置” opens the New Label dialog (creating a new document). Editing an
 * existing document's page geometry uses “模板属性设置”.
 */
export const LABEL_FORMAT_SETTINGS_MODAL: ModalKind = 'new'

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

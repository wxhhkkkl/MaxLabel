import { randomUUID } from 'crypto'
import type { MallContext } from '../shared/ipcContract'
import { withMallToken } from './mallAuth'
import { readMallDeviceId } from './mallCredentials'
import { reportMallPrintRecord } from './mallRepository'

export interface PrintReportRecord {
  time: string
  title: string
  mode: string
  count: number
  copies: number
  physicalCount?: number
  sentCount?: number
  status?: 'completed' | 'submitted' | 'partial' | 'failed' | 'canceled' | 'unknown'
  printer: string
}

function localDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 19)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * 上报一条打印记录。调用方必须 fire-and-forget，失败不影响打印与本地日志。
 * 只上报结构化字段，绝不包含 dataSnapshot / 模板正文。
 */
export async function reportPrintRecord(context: MallContext, record: PrintReportRecord): Promise<void> {
  const deviceId = await readMallDeviceId(context.baseUrl)
  await withMallToken(context, (token) => reportMallPrintRecord(context, token, {
    recordUid: randomUUID(),
    deviceId,
    printTime: localDateTime(record.time),
    templateTitle: record.title,
    mode: record.mode,
    count: record.count,
    copies: record.copies,
    ...(record.physicalCount === undefined ? {} : { physicalCount: record.physicalCount }),
    ...(record.sentCount === undefined ? {} : { sentCount: record.sentCount }),
    status: record.status ?? 'unknown',
    printer: record.printer
  }))
}

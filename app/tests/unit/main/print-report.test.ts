import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@main/mallAuth', () => ({ withMallToken: vi.fn() }))
vi.mock('@main/mallCredentials', () => ({ readMallDeviceId: vi.fn() }))
vi.mock('@main/mallRepository', () => ({ reportMallPrintRecord: vi.fn() }))

import { withMallToken } from '@main/mallAuth'
import { readMallDeviceId } from '@main/mallCredentials'
import { reportMallPrintRecord } from '@main/mallRepository'
import { reportPrintRecord } from '@main/printReport'

const withToken = vi.mocked(withMallToken)
const deviceId = vi.mocked(readMallDeviceId)
const report = vi.mocked(reportMallPrintRecord)

beforeEach(() => {
  withToken.mockReset()
  deviceId.mockReset()
  report.mockReset()
  withToken.mockImplementation((_context, run) => run('token-1'))
  deviceId.mockResolvedValue('2b7e0000-0000-4000-8000-000000000001')
  report.mockResolvedValue()
})

describe('print report', () => {
  it('reports only structured fields and never the data snapshot', async () => {
    await reportPrintRecord({ baseUrl: 'https://mall.test', tenantId: 162 }, {
      time: '2026-10-20T10:00:00.000Z',
      title: '顺丰面单',
      mode: 'driver',
      count: 10,
      copies: 1,
      physicalCount: 10,
      sentCount: 10,
      status: 'completed',
      printer: 'Zebra ZT410'
    })

    expect(report).toHaveBeenCalledTimes(1)
    const payload = report.mock.calls[0][2] as Record<string, unknown>
    expect(payload).toMatchObject({
      deviceId: '2b7e0000-0000-4000-8000-000000000001',
      templateTitle: '顺丰面单',
      mode: 'driver',
      count: 10,
      status: 'completed',
      printer: 'Zebra ZT410'
    })
    expect(payload.recordUid).toMatch(/^[0-9a-f-]{36}$/)
    expect(payload.printTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
    expect(payload).not.toHaveProperty('dataSnapshot')
  })
})

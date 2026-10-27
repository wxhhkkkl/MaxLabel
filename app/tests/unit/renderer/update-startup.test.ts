// @vitest-environment jsdom
import { act } from 'react-dom/test-utils'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useUpdateStartup } from '@/features/shell/useUpdateStartup'
import type { UpdateCheckResultDto } from '@shared/ipcContract'

const check = vi.fn()

function installApi() {
  ;(window as unknown as { maxlabel: unknown }).maxlabel = {
    update: { check }
  }
}

function Probe({ enabled, onUpdate }: { enabled: boolean; onUpdate: (result: UpdateCheckResultDto) => void }) {
  useUpdateStartup(enabled, onUpdate)
  return null
}

let root: Root | null = null
let host: HTMLDivElement | null = null

afterEach(() => {
  if (root) {
    act(() => root!.unmount())
    root = null
  }
  host?.remove()
  host = null
  check.mockReset()
})

async function render(enabled: boolean, onUpdate: (result: UpdateCheckResultDto) => void) {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root!.render(createElement(Probe, { enabled, onUpdate }))
  })
  await act(async () => {
    await Promise.resolve()
  })
}

describe('useUpdateStartup', () => {
  it('checks once and calls back only when a newer version exists', async () => {
    installApi()
    check.mockResolvedValue({ status: 'update', current: '1.0.22', latest: '1.0.23' })
    const onUpdate = vi.fn()
    await render(true, onUpdate)
    expect(check).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'update', latest: '1.0.23' }))
  })

  it('does not call back for latest', async () => {
    installApi()
    check.mockResolvedValue({ status: 'latest', current: '1.0.22' })
    const onUpdate = vi.fn()
    await render(true, onUpdate)
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('stays silent on check failures', async () => {
    installApi()
    check.mockRejectedValue(new Error('offline'))
    const onUpdate = vi.fn()
    await render(true, onUpdate)
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('does not even check when the setting disables startup checks', async () => {
    installApi()
    const onUpdate = vi.fn()
    await render(false, onUpdate)
    expect(check).not.toHaveBeenCalled()
    expect(onUpdate).not.toHaveBeenCalled()
  })
})

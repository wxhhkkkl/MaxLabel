// @vitest-environment jsdom
import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { executePrint } from '@/features/printing/printExecutor'
import { usePrintWorkflow } from '@/features/printing/usePrintWorkflow'
import { useAsyncOperation } from '@/features/shell/useAsyncOperation'

vi.mock('@/features/printing/printExecutor', () => ({ executePrint: vi.fn() }))

it('blocks another print while the canceled job settles its receipt and serial writeback', async () => {
  const cancelPrint = vi.fn(async () => undefined)
  vi.stubGlobal('maxlabel', { cancelPrint })
  const root = createRoot(document.createElement('div'))
  let workflow!: ReturnType<typeof usePrintWorkflow>
  function Harness() {
    workflow = usePrintWorkflow(useAsyncOperation())
    return null
  }
  let settle!: (result: boolean) => void
  const done = new Promise<boolean>((resolve) => { settle = resolve })
  vi.mocked(executePrint).mockReturnValueOnce(done).mockResolvedValueOnce(true)
  const deps = {} as Parameters<typeof workflow.run>[1]
  try {
    flushSync(() => root.render(createElement(Harness)))
    const first = workflow.run(false, deps, {})!
    expect(workflow.cancel()).toBe(true)
    const firstExecution = vi.mocked(executePrint).mock.calls[0][1]
    expect(firstExecution.signal?.aborted).toBe(true)
    expect(cancelPrint).toHaveBeenCalledWith(firstExecution.jobId)
    expect(workflow.run(false, deps, {})).toBeUndefined()
    expect(executePrint).toHaveBeenCalledTimes(1)
    settle(false)
    await first.done
    await expect(workflow.run(false, deps, {})?.done).resolves.toBe(true)
  } finally {
    flushSync(() => root.unmount())
    vi.unstubAllGlobals()
  }
})

import { describe, expect, it } from 'vitest'
import { startView } from '@/pages/StartPage'
import type { MallMember } from '@shared/ipcContract'

const member: MallMember = {
  userId: 1001,
  mobileMasked: '138****0000',
  subscriptionActive: true
}

describe('start page view selection', () => {
  it('shows a checking state until the session check finishes', () => {
    expect(startView(false, null)).toBe('checking')
    expect(startView(false, member)).toBe('checking')
  })

  it('prompts login when the session check found no member', () => {
    expect(startView(true, null)).toBe('login')
  })

  it('shows the mall once a member is present', () => {
    expect(startView(true, member)).toBe('mall')
  })
})

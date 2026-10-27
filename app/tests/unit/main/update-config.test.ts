import { describe, expect, it } from 'vitest'
import { DEFAULT_UPDATE_FEED, resolveUpdateFeedUrl } from '@main/update/updateConfig'

describe('update feed config', () => {
  it('uses the fixed trusted feed for packaged builds and ignores runtime overrides', () => {
    expect(resolveUpdateFeedUrl({ packaged: true })).toBe(DEFAULT_UPDATE_FEED)
    expect(resolveUpdateFeedUrl({ packaged: true, override: 'http://127.0.0.1:8787/updates/' })).toBe(DEFAULT_UPDATE_FEED)
  })

  it('allows a local test feed only in non-packaged builds', () => {
    expect(resolveUpdateFeedUrl({ packaged: false, override: 'http://127.0.0.1:8787/updates/' }))
      .toBe('http://127.0.0.1:8787/updates/')
  })

  it('falls back to the fixed feed for invalid overrides', () => {
    expect(resolveUpdateFeedUrl({ packaged: false, override: 'javascript:alert(1)' })).toBe(DEFAULT_UPDATE_FEED)
    expect(resolveUpdateFeedUrl({ packaged: false, override: 'not a url' })).toBe(DEFAULT_UPDATE_FEED)
  })
})

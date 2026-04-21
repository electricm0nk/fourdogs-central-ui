import { describe, expect, it, vi, afterEach } from 'vitest'
import { buildKayleeStreamUrl } from '@/lib/kayleeStream'

describe('buildKayleeStreamUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('includes the stream token and dev session id when present', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn(() => 'session-123'),
      },
    })

    expect(buildKayleeStreamUrl('/dev-api', 'order-123', 'token-abc')).toBe(
      '/dev-api/v1/orders/order-123/kaylee/stream?msg=token-abc&sid=session-123',
    )
  })

  it('omits sid when no dev session id is available', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn(() => ''),
      },
    })

    expect(buildKayleeStreamUrl('', 'order-123', 'token-abc')).toBe(
      '/v1/orders/order-123/kaylee/stream?msg=token-abc',
    )
  })
})
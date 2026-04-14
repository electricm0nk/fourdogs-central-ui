import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKayleeStream } from '@/hooks/use_kaylee_stream'

describe('useKayleeStream — 30s timeout', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function makeMockES() {
    const instance = {
      onmessage: null as ((e: MessageEvent) => void) | null,
      onerror: null as ((e: Event) => void) | null,
      close: vi.fn(),
    }
    // Must use function (not arrow) so it can be called as a constructor.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.stubGlobal('EventSource', function MockEventSource(this: any) {
      Object.assign(this, instance)
      instance.onmessage = (e) => this.onmessage?.(e)
      // Proxy instance properties to the 'this' object for consistency
      ;(this as typeof instance).close = instance.close
      return instance
    })
    return instance
  }

  it('transitions to timeout after 30s without [DONE]', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const es = makeMockES()

    const { result } = renderHook(() => useKayleeStream('order-123'))

    act(() => { result.current.start() })
    expect(result.current.status).toBe('streaming')

    act(() => { vi.advanceTimersByTime(30_001) })

    expect(result.current.status).toBe('timeout')
    expect(es.close).toHaveBeenCalled()
  })

  it('clears 30s timer when [DONE] received — no phantom timeout', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const es = makeMockES()

    const { result } = renderHook(() => useKayleeStream('order-123'))

    act(() => {
      result.current.start()
      es.onmessage?.({ data: '[DONE]' } as MessageEvent)
    })
    expect(result.current.status).toBe('done')

    act(() => { vi.advanceTimersByTime(35_000) })
    expect(result.current.status).toBe('done') // still done, not timeout
  })

  it('tokens arrive before timeout remains streaming', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const es = makeMockES()

    const { result } = renderHook(() => useKayleeStream('order-123'))

    act(() => {
      result.current.start()
      es.onmessage?.({ data: '{"token":"Hello"}' } as MessageEvent)
    })
    expect(result.current.tokens).toEqual(['Hello'])
    expect(result.current.status).toBe('streaming')
  })
})

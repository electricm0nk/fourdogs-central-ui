import { useState, useCallback, useRef } from 'react'

export type StreamStatus = 'idle' | 'streaming' | 'done' | 'error' | 'timeout'

const STREAM_TIMEOUT_MS = 30_000

export function useKayleeStream(orderId: string) {
  const [tokens, setTokens] = useState<string[]>([])
  const [status, setStatus] = useState<StreamStatus>('idle')
  const esRef = useRef<EventSource | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const start = useCallback(() => {
    esRef.current?.close()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setTokens([])
    setStatus('streaming')

    const es = new EventSource(`/v1/orders/${orderId}/kaylee/stream`, {
      withCredentials: true,
    })
    esRef.current = es

    timeoutRef.current = setTimeout(() => {
      setStatus('timeout')
      es.close()
    }, STREAM_TIMEOUT_MS)

    es.onmessage = (e) => {
      if (e.data === '[DONE]') {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setStatus('done')
        es.close()
        return
      }
      try {
        const parsed = JSON.parse(e.data)
        if (parsed.error) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
          setStatus('error')
          es.close()
          return
        }
        setTokens((prev) => [...prev, parsed.token as string])
      } catch {
        // ignore malformed events
      }
    }

    es.onerror = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setStatus('error')
      es.close()
    }
  }, [orderId])

  return { tokens, status, start }
}

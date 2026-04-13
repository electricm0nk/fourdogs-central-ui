import { useState, useCallback, useRef } from 'react'

export type StreamStatus = 'idle' | 'streaming' | 'done' | 'error'

export function useKayleeStream(orderId: string) {
  const [tokens, setTokens] = useState<string[]>([])
  const [status, setStatus] = useState<StreamStatus>('idle')
  const esRef = useRef<EventSource | null>(null)

  const start = useCallback(() => {
    esRef.current?.close()
    setTokens([])
    setStatus('streaming')

    const es = new EventSource(`/v1/orders/${orderId}/kaylee/stream`, {
      withCredentials: true,
    })
    esRef.current = es

    es.onmessage = (e) => {
      if (e.data === '[DONE]') {
        setStatus('done')
        es.close()
        return
      }
      try {
        const parsed = JSON.parse(e.data)
        if (parsed.error) {
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
      setStatus('error')
      es.close()
    }
  }, [orderId])

  return { tokens, status, start }
}

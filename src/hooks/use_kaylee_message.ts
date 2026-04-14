import { useCallback } from 'react'
import { api } from '@/lib/api'

export function useKayleeMessage(orderId: string) {
  const sendMessage = useCallback(
    async (text: string): Promise<string> => {
      const res = await api.post<{ stream_token: string }>(
        `/v1/orders/${orderId}/kaylee/message`,
        { text },
      )
      return res.stream_token
    },
    [orderId],
  )

  return { sendMessage }
}

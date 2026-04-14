import { useCallback } from 'react'
import { api } from '@/lib/api'

export type LogLearningArgs = {
  orderId: string
  itemSku: string
  actionType: 'qty_edit' | 'accept_ghost' | 'reject_ghost' | 'override_tier1'
  kayleeRecQty: number | null
  finalQty: number
  confidenceTier: number | null
}

export function useLogLearning(): (args: LogLearningArgs) => void {
  return useCallback((args: LogLearningArgs) => {
    api
      .post(`/v1/orders/${args.orderId}/learning`, {
        item_id: args.itemSku,
        action_type: args.actionType,
        kaylee_rec_qty: args.kayleeRecQty,
        final_qty: args.finalQty,
        confidence_tier: args.confidenceTier,
      })
      .catch(() => {}) // fire-and-forget; errors silently swallowed
  }, [])
}

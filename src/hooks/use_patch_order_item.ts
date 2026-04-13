import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { OrderItem } from '@/types/order_item'

interface PatchOrderItemArgs {
  orderId: string
  itemId: string
  final_qty?: number
  must_have?: boolean
}

export function usePatchOrderItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, itemId, ...body }: PatchOrderItemArgs) =>
      api.patch<{ data: OrderItem }>(`/v1/orders/${orderId}/items/${itemId}`, body),
    onSuccess: (_data, { orderId }) => {
      qc.invalidateQueries({ queryKey: ['orders', orderId, 'items'] })
    },
  })
}

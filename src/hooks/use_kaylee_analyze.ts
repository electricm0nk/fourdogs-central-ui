import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useKayleeAnalyze() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) =>
      api.post<{ data: { items_analyzed: number; tier1_applied: number } }>(
        `/v1/orders/${orderId}/kaylee/analyze`,
        {}
      ),
    onSuccess: (_data, orderId) => {
      qc.invalidateQueries({ queryKey: ['orders', orderId, 'items'] })
    },
  })
}

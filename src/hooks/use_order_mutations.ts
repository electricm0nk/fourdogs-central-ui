import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useSubmitOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, submitted }: { id: string; submitted: boolean }) =>
      api.patch(`/v1/orders/${id}`, { submitted }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['order', id] })
    },
  })
}

export function useArchiveOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      api.patch(`/v1/orders/${id}`, { archived: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Order } from '@/types/order'

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get<{ data: Order }>(`/v1/orders/${id}`),
    select: (res) => res.data,
    enabled: !!id,
  })
}

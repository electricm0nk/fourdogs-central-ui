import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Order } from '@/types/order'

export function useOrders(archived = false) {
  return useQuery({
    queryKey: ['orders', { archived }],
    queryFn: () => api.get<{ data: Order[] }>(`/v1/orders${archived ? '?archived=true' : ''}`),
    select: (res) => res.data,
  })
}

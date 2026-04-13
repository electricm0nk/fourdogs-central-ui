import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { OrderItem } from '@/types/order_item'

export function useOrderItems(orderId: string, search = '') {
  const qs = search ? `?q=${encodeURIComponent(search)}` : ''
  return useQuery({
    queryKey: ['orders', orderId, 'items', { search }],
    queryFn: () => api.get<{ data: OrderItem[] }>(`/v1/orders/${orderId}/items${qs}`),
    select: (res) => res.data,
    enabled: !!orderId,
  })
}

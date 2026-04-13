import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { VendorAdapter } from '@/types/order'

export function useVendorAdapters() {
  return useQuery({
    queryKey: ['vendor-adapters'],
    queryFn: () => api.get<{ data: VendorAdapter[] }>('/v1/vendor-adapters'),
    select: (res) => res.data,
  })
}

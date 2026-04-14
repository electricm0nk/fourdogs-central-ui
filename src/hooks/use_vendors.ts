import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Vendor {
  id: number
  vendor_etp_id: number
  name: string
  sku_count: number
}

export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get<{ data: Vendor[] }>('/v1/vendors'),
    select: (res) => res.data ?? [],
  })
}

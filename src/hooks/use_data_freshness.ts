import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { DataFreshnessResponse } from '@/types/data_freshness'

export function useDataFreshness() {
  return useQuery({
    queryKey: ['data-freshness'],
    queryFn: () => api.get<{ data: DataFreshnessResponse }>('/v1/data-freshness'),
    select: (res) => res.data,
    retry: false,
  })
}

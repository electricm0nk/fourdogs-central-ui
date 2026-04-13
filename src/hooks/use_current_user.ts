import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface User {
  google_sub: string
  email: string
  name: string
  preferences?: {
    kaylee_mode?: 'chatty' | 'sleepy'
    onboarding_shown?: boolean
  }
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<{ data: User }>('/v1/me'),
    select: (res) => res.data,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

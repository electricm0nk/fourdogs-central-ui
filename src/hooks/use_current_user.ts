import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface User {
  google_sub: string
  email: string
  name: string
  preferences?: {
    kaylee_mode?: 'chatty' | 'sleepy'
  }
}

export function useCurrentUser() {
  return useQuery<User>({
    queryKey: ['me'],
    queryFn: () => api.get<User>('/v1/me'),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

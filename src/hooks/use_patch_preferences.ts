import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function usePatchPreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (prefs: { kaylee_mode: 'chatty' | 'sleepy' }) =>
      api.patch<{ data: { kaylee_mode: string } }>('/v1/me/preferences', prefs),
    onMutate: async (prefs) => {
      await qc.cancelQueries({ queryKey: ['me'] })
      const prev = qc.getQueryData(['me'])
      qc.setQueryData(['me'], (old: any) => {
        if (!old) return old
        return { ...old, preferences: prefs }
      })
      return { prev }
    },
    onError: (_err, _vars, context: any) => {
      if (context?.prev !== undefined) {
        qc.setQueryData(['me'], context.prev)
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

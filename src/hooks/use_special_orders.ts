import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import type { SpecialOrdersStaging, CsvRowError, ImportResult } from '@/types/special_order'

export function useSpecialOrdersStaging(orderId?: string) {
  const qs = orderId ? `?order_id=${orderId}` : ''
  return useQuery({
    queryKey: ['special-orders-staging', orderId ?? 'mine'],
    queryFn: () =>
      api.get<{ data: SpecialOrdersStaging[] }>(`/v1/special-orders/staging${qs}`),
    select: (res) => res.data,
  })
}

export type ImportState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'success'; result: ImportResult }
  | { status: 'error'; rowErrors: CsvRowError[]; message?: string }

export function useImportSpecialOrders() {
  const queryClient = useQueryClient()
  const [state, setState] = useState<ImportState>({ status: 'idle' })

  const { mutate: upload } = useMutation({
    mutationFn: async (file: File) => {
      setState({ status: 'uploading' })
      const form = new FormData()
      form.append('file', file)
      return api.postForm<{ data: ImportResult }>('/v1/special-orders/import', form)
    },
    onSuccess: (res) => {
      setState({ status: 'success', result: res.data })
      queryClient.invalidateQueries({ queryKey: ['special-orders-staging'] })
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 400) {
        const body = err.body as { row_errors?: CsvRowError[]; message?: string } | null
        setState({
          status: 'error',
          rowErrors: body?.row_errors ?? [],
          message: body?.message,
        })
      } else {
        setState({ status: 'error', rowErrors: [], message: 'Upload failed. Please try again.' })
      }
    },
  })

  return { upload, state, reset: () => setState({ status: 'idle' }) }
}

export function useConfirmSpecialOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ data: { order_item_id: string; staging_id: string } }>(
        `/v1/special-orders/${id}/confirm`,
        {}
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['special-orders-staging'] })
    },
  })
}

export function useDiscardSpecialOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ data: { staging_id: string; status: string } }>(
        `/v1/special-orders/${id}/discard`,
        {}
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['special-orders-staging'] })
    },
  })
}

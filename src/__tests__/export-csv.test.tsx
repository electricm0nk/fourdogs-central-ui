import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrderDetail } from '@/pages/OrderDetail'
import { useOrder } from '@/hooks/use_order'
import { useSubmitOrder, useArchiveOrder } from '@/hooks/use_order_mutations'
import type { Order } from '@/types/order'

vi.mock('@/hooks/use_order', () => ({ useOrder: vi.fn() }))
vi.mock('@/hooks/use_order_mutations', () => ({
  useSubmitOrder: vi.fn(),
  useArchiveOrder: vi.fn(),
}))

const submittedOrder: Order = {
  id: '00000000-0000-0000-0000-000000000001',
  vendor_adapter_id: '00000000-0000-0000-0000-000000000002',
  vendor_name: 'Southeast Pet',
  created_by: 'test-sub',
  order_date: '2026-04-13',
  submitted: true,
  archived: false,
  created_at: '2026-04-13T00:00:00Z',
}

function orderDetailWrapper(id: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/orders/${id}`]}>
        <Routes>
          <Route path="/orders/:id" element={<OrderDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function setupOrderMocks(order = submittedOrder) {
  vi.mocked(useOrder).mockReturnValue({
    data: order,
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useOrder>)
  vi.mocked(useSubmitOrder).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useSubmitOrder>)
  vi.mocked(useArchiveOrder).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useArchiveOrder>)
}

function mockFetchCSV() {
  const mockBlob = new Blob(['SKU,Description\nSKU-A,Dog Food,3'], { type: 'text/csv' })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(mockBlob),
    headers: { get: () => 'attachment; filename="export.csv"' },
  }))
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
  vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined)
}

describe('ExportCSVButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupOrderMocks()
  })

  it('shows "Export CSV" button for submitted order', () => {
    render(orderDetailWrapper(submittedOrder.id))
    expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument()
  })

  it('does not show "Export CSV" button for unsubmitted order', () => {
    setupOrderMocks({ ...submittedOrder, submitted: false })
    render(orderDetailWrapper(submittedOrder.id))
    expect(screen.queryByRole('button', { name: /export csv/i })).not.toBeInTheDocument()
  })

  it('calls fetch with the correct export URL on click', async () => {
    mockFetchCSV()
    render(orderDetailWrapper(submittedOrder.id))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /export csv/i }))
    })

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      `/v1/orders/${submittedOrder.id}/export/csv`,
      { credentials: 'include' }
    )
  })

  it('shows "✓ Downloaded" after successful export', async () => {
    mockFetchCSV()
    render(orderDetailWrapper(submittedOrder.id))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /export csv/i }))
    })

    expect(screen.getByRole('button', { name: /✓ downloaded/i })).toBeInTheDocument()
  })

  it('reverts button label to "Export CSV" after 3 seconds', async () => {
    vi.useFakeTimers()
    mockFetchCSV()
    render(orderDetailWrapper(submittedOrder.id))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /export csv/i }))
    })

    expect(screen.getByRole('button', { name: /✓ downloaded/i })).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /✓ downloaded/i })).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})

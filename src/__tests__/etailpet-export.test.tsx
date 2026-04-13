import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrderDetail } from '@/pages/OrderDetail'
import { useOrder } from '@/hooks/use_order'
import { useSubmitOrder, useArchiveOrder } from '@/hooks/use_order_mutations'
import { useVendorAdapters } from '@/hooks/use_vendor_adapters'
import type { Order, VendorAdapter } from '@/types/order'

vi.mock('@/hooks/use_order', () => ({ useOrder: vi.fn() }))
vi.mock('@/hooks/use_order_mutations', () => ({
  useSubmitOrder: vi.fn(),
  useArchiveOrder: vi.fn(),
}))
vi.mock('@/hooks/use_vendor_adapters', () => ({ useVendorAdapters: vi.fn() }))

const etailpetAdapter: VendorAdapter = {
  id: '00000000-0000-0000-0000-000000000099',
  name: 'EtailPet',
  adapter_type: 'etailpet',
  created_at: '2026-04-13T00:00:00Z',
}

const sepAdapter: VendorAdapter = {
  id: '00000000-0000-0000-0000-000000000002',
  name: 'Southeast Pet',
  adapter_type: 'sep',
  created_at: '2026-04-13T00:00:00Z',
}

const etailpetOrder: Order = {
  id: '00000000-0000-0000-0000-000000000001',
  vendor_adapter_id: etailpetAdapter.id,
  vendor_name: 'EtailPet',
  created_by: 'test-sub',
  order_date: '2026-04-13',
  submitted: true,
  archived: false,
  created_at: '2026-04-13T00:00:00Z',
}

const sepOrder: Order = {
  ...etailpetOrder,
  vendor_adapter_id: sepAdapter.id,
  vendor_name: 'Southeast Pet',
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

function setupMocks(order: Order, adapters: VendorAdapter[]) {
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
  vi.mocked(useVendorAdapters).mockReturnValue({
    data: adapters,
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useVendorAdapters>)
}

describe('EtailPet export button', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()
  })

  it('shows "Export EtailPet" button for etailpet orders', () => {
    setupMocks(etailpetOrder, [etailpetAdapter])
    render(orderDetailWrapper(etailpetOrder.id))
    expect(screen.getByRole('button', { name: /export etailpet/i })).toBeInTheDocument()
  })

  it('shows "Export CSV" alongside "Export EtailPet" for etailpet orders', () => {
    setupMocks(etailpetOrder, [etailpetAdapter])
    render(orderDetailWrapper(etailpetOrder.id))
    expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export etailpet/i })).toBeInTheDocument()
  })

  it('does NOT show "Export EtailPet" for SEP orders', () => {
    setupMocks(sepOrder, [sepAdapter])
    render(orderDetailWrapper(sepOrder.id))
    expect(screen.queryByRole('button', { name: /export etailpet/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument()
  })

  it('Export EtailPet calls the same export endpoint', async () => {
    const mockBlob = new Blob(['VendorItemCode,ProductName'], { type: 'text/csv' })
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
      headers: { get: () => 'attachment; filename="etailpet-order-20260413.csv"' },
    })
    setupMocks(etailpetOrder, [etailpetAdapter])
    render(orderDetailWrapper(etailpetOrder.id))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /export etailpet/i }))
    })

    expect(global.fetch).toHaveBeenCalledWith(
      `/v1/orders/${etailpetOrder.id}/export/csv`,
      { credentials: 'include' }
    )
  })

  it('shows "✓ Downloaded" after EtailPet export completes', async () => {
    const mockBlob = new Blob(['VendorItemCode,ProductName'], { type: 'text/csv' })
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
      headers: { get: () => null },
    })
    setupMocks(etailpetOrder, [etailpetAdapter])
    render(orderDetailWrapper(etailpetOrder.id))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /export etailpet/i }))
    })

    expect(screen.getByRole('button', { name: /✓ downloaded/i })).toBeInTheDocument()
  })
})

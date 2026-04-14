import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Dashboard } from '@/pages/Dashboard'
import { OrderDetail } from '@/pages/OrderDetail'
import { useOrders } from '@/hooks/use_orders'
import { useOrder } from '@/hooks/use_order'
import { useVendorAdapters } from '@/hooks/use_vendor_adapters'
import { useSubmitOrder, useArchiveOrder } from '@/hooks/use_order_mutations'
import type { Order, VendorAdapter } from '@/types/order'

vi.mock('@/hooks/use_orders', () => ({ useOrders: vi.fn() }))
vi.mock('@/hooks/use_order', () => ({ useOrder: vi.fn() }))
vi.mock('@/hooks/use_vendor_adapters', () => ({ useVendorAdapters: vi.fn() }))
vi.mock('@/hooks/use_order_mutations', () => ({
  useSubmitOrder: vi.fn(),
  useArchiveOrder: vi.fn(),
}))

const activeOrder: Order = {
  id: '00000000-0000-0000-0000-000000000001',
  vendor_adapter_id: '00000000-0000-0000-0000-000000000002',
  vendor_name: 'Southeast Pet',
  created_by: 'test-sub',
  order_date: '2026-04-12',
  submitted: false,
  archived: false,
  created_at: '2026-04-12T00:00:00Z',
}

const submittedOrder: Order = { ...activeOrder, submitted: true }

const archivedOrder: Order = {
  ...activeOrder,
  id: '00000000-0000-0000-0000-000000000099',
  archived: true,
}

const mockAdapter: VendorAdapter = {
  id: '00000000-0000-0000-0000-000000000002',
  name: 'Southeast Pet',
  adapter_type: 'sep',
  created_at: '2026-04-12T00:00:00Z',
}

function wrapper(children: React.ReactNode, initialPath = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={children} />
          <Route path="/orders/:id" element={<OrderDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function orderDetailWrapper(id: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
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

describe('Dashboard — archive lifecycle', () => {
  const mockArchiveMutate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useVendorAdapters).mockReturnValue({
      data: [mockAdapter],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useVendorAdapters>)
    vi.mocked(useArchiveOrder).mockReturnValue({
      mutate: mockArchiveMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useArchiveOrder>)
    vi.mocked(useSubmitOrder).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useSubmitOrder>)
  })

  it('does not show archive button on active order row', () => {
    vi.mocked(useOrders).mockReturnValue({
      data: [activeOrder],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrders>)

    render(wrapper(<Dashboard />))

    expect(screen.queryByRole('button', { name: /^archive$/i })).not.toBeInTheDocument()
  })

  it('shows active-order actions (floor walk, worksheet, mark ordered)', () => {
    vi.mocked(useOrders).mockReturnValue({
      data: [activeOrder],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrders>)

    render(wrapper(<Dashboard />))

    expect(screen.getByRole('button', { name: /^floor walk$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^worksheet$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^mark ordered$/i })).toBeInTheDocument()
  })

  it('shows Show Archived toggle button', () => {
    vi.mocked(useOrders).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrders>)

    render(wrapper(<Dashboard />))

    expect(screen.getByRole('button', { name: /show archived/i })).toBeInTheDocument()
  })

  it('toggles to show archived orders section', () => {
    vi.mocked(useOrders)
      .mockReturnValueOnce({
        data: [],
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useOrders>)
      .mockReturnValueOnce({
        data: [archivedOrder],
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useOrders>)

    render(wrapper(<Dashboard />))
    fireEvent.click(screen.getByRole('button', { name: /show archived/i }))

    expect(screen.getByText(/^Archived Orders$/i)).toBeInTheDocument()
  })
})

describe('OrderDetail — submit lifecycle', () => {
  const mockSubmitMutate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSubmitOrder).mockReturnValue({
      mutate: mockSubmitMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useSubmitOrder>)
    vi.mocked(useArchiveOrder).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useArchiveOrder>)
  })

  it('shows Mark Submitted button for unsubmitted order', () => {
    vi.mocked(useOrder).mockReturnValue({
      data: activeOrder,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)

    render(orderDetailWrapper(activeOrder.id))

    expect(screen.getByRole('button', { name: /mark submitted/i })).toBeInTheDocument()
  })

  it('fires PATCH submitted=true when Mark Submitted clicked', () => {
    vi.mocked(useOrder).mockReturnValue({
      data: activeOrder,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)

    render(orderDetailWrapper(activeOrder.id))
    fireEvent.click(screen.getByRole('button', { name: /mark submitted/i }))

    expect(mockSubmitMutate).toHaveBeenCalledWith({ id: activeOrder.id, submitted: true })
  })

  it('shows Unsubmit button for submitted order', () => {
    vi.mocked(useOrder).mockReturnValue({
      data: submittedOrder,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)

    render(orderDetailWrapper(submittedOrder.id))

    expect(screen.getByRole('button', { name: /unsubmit/i })).toBeInTheDocument()
  })

  it('fires PATCH submitted=false when Unsubmit clicked', () => {
    vi.mocked(useOrder).mockReturnValue({
      data: submittedOrder,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)

    render(orderDetailWrapper(submittedOrder.id))
    fireEvent.click(screen.getByRole('button', { name: /unsubmit/i }))

    expect(mockSubmitMutate).toHaveBeenCalledWith({ id: submittedOrder.id, submitted: false })
  })

  it('shows read-only indicator for submitted order', () => {
    vi.mocked(useOrder).mockReturnValue({
      data: submittedOrder,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)

    render(orderDetailWrapper(submittedOrder.id))

    expect(screen.getByText(/read.only/i)).toBeInTheDocument()
  })

  it('shows loading state while order fetches', () => {
    vi.mocked(useOrder).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)

    render(orderDetailWrapper(activeOrder.id))

    expect(screen.queryByRole('button', { name: /mark submitted/i })).not.toBeInTheDocument()
  })
})

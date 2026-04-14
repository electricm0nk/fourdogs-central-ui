import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Dashboard } from '@/pages/Dashboard'
import { useOrders } from '@/hooks/use_orders'
import { useVendorAdapters } from '@/hooks/use_vendor_adapters'
import type { Order, VendorAdapter } from '@/types/order'

vi.mock('@/hooks/use_orders', () => ({ useOrders: vi.fn() }))
vi.mock('@/hooks/use_vendor_adapters', () => ({ useVendorAdapters: vi.fn() }))

const mockOrder: Order = {
  id: '00000000-0000-0000-0000-000000000001',
  vendor_adapter_id: '00000000-0000-0000-0000-000000000002',
  vendor_name: 'Southeast Pet',
  created_by: 'test-sub',
  order_date: '2026-04-12',
  submitted: false,
  archived: false,
  created_at: '2026-04-12T00:00:00Z',
}

const mockAdapter: VendorAdapter = {
  id: '00000000-0000-0000-0000-000000000002',
  name: 'Southeast Pet',
  adapter_type: 'sep',
  created_at: '2026-04-12T00:00:00Z',
}

function wrapper(children: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={children} />
          <Route path="/orders/:id" element={<div>Order Detail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useVendorAdapters).mockReturnValue({
      data: [mockAdapter],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useVendorAdapters>)
  })

  it('renders order list with correct count', () => {
    vi.mocked(useOrders).mockReturnValue({
      data: [mockOrder],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrders>)

    render(wrapper(<Dashboard />))

    expect(screen.getByText('Southeast Pet')).toBeInTheDocument()
    expect(screen.getByText('Apr 12, 2026')).toBeInTheDocument()
  })

  it('shows loading state while orders are fetching', () => {
    vi.mocked(useOrders).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useOrders>)

    render(wrapper(<Dashboard />))

    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('renders DataFreshnessPanel placeholder', () => {
    vi.mocked(useOrders).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrders>)

    render(wrapper(<Dashboard />))

    expect(screen.getByText(/\.\.\. loading/i)).toBeInTheDocument()
  })

  it('shows "+ New Order" button', () => {
    vi.mocked(useOrders).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrders>)

    render(wrapper(<Dashboard />))

    expect(screen.getByRole('button', { name: /\+ new order/i })).toBeInTheDocument()
  })

  it('opens create order modal when button is clicked', () => {
    vi.mocked(useOrders).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrders>)

    render(wrapper(<Dashboard />))

    fireEvent.click(screen.getByRole('button', { name: /\+ new order/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows ordered badge for submitted orders', () => {
    const submittedOrder = { ...mockOrder, submitted: true }
    vi.mocked(useOrders).mockReturnValue({
      data: [submittedOrder],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrders>)

    render(wrapper(<Dashboard />))

    expect(screen.getByText('Ordered')).toBeInTheDocument()
  })

  it('shows In Progress badge for non-submitted orders', () => {
    vi.mocked(useOrders).mockReturnValue({
      data: [mockOrder],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrders>)

    render(wrapper(<Dashboard />))

    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })
})

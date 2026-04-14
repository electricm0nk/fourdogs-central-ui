import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrderDetail } from '@/pages/OrderDetail'
import { useOrder } from '@/hooks/use_order'
import { useOrderItems } from '@/hooks/use_order_items'
import { useSubmitOrder, useArchiveOrder } from '@/hooks/use_order_mutations'
import type { Order } from '@/types/order'
import type { OrderItem } from '@/types/order_item'

vi.mock('@/hooks/use_order', () => ({ useOrder: vi.fn() }))
vi.mock('@/hooks/use_order_items', () => ({ useOrderItems: vi.fn() }))
vi.mock('@/hooks/use_order_mutations', () => ({
  useSubmitOrder: vi.fn(),
  useArchiveOrder: vi.fn(),
}))

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

const mustHaveItem: OrderItem = {
  id: '00000000-0000-0000-0000-000000000010',
  order_id: mockOrder.id,
  item_id: 'SKU-001',
  item_name: 'Bark Biscuits',
  category: 'snacks',
  current_stock_qty: 0,
  velocity_tier: 'high',
  must_have: true,
  final_qty: 0,
  ghost_qty: null,
  confidence_tier: null,
}

const regularItem: OrderItem = {
  id: '00000000-0000-0000-0000-000000000011',
  order_id: mockOrder.id,
  item_id: 'SKU-002',
  item_name: 'Dog Food 24lb',
  category: 'food',
  current_stock_qty: 5,
  velocity_tier: null,
  must_have: false,
  final_qty: 3,
  ghost_qty: null,
  confidence_tier: null,
}

function wrapper(id: string, search = '') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const path = search ? `/orders/${id}?tab=floorwalk` : `/orders/${id}?tab=floorwalk`
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/orders/:id" element={<OrderDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Floor Walk Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useOrder).mockReturnValue({
      data: mockOrder,
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
  })

  it('shows Floor Walk tab on order detail page', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    render(wrapper(mockOrder.id))

    expect(screen.getByRole('tab', { name: /floor walk/i })).toBeInTheDocument()
  })

  it('renders item list when Floor Walk tab is active', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [mustHaveItem, regularItem],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    render(wrapper(mockOrder.id))

    expect(screen.getByText('Bark Biscuits')).toBeInTheDocument()
    expect(screen.getByText('Dog Food 24lb')).toBeInTheDocument()
  })

  it('shows must-have badge on must-have items', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [mustHaveItem],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    render(wrapper(mockOrder.id))

    expect(screen.getByText(/must.have/i)).toBeInTheDocument()
  })

  it('shows loading skeleton while items fetch', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    render(wrapper(mockOrder.id))

    // 5 skeleton rows
    expect(screen.getAllByTestId('item-skeleton').length).toBe(5)
  })

  it('shows empty state when no items', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    render(wrapper(mockOrder.id))

    expect(screen.getByText(/no items on this order/i)).toBeInTheDocument()
  })
})

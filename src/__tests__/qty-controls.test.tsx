import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrderDetail } from '@/pages/OrderDetail'
import { useOrder } from '@/hooks/use_order'
import { useOrderItems } from '@/hooks/use_order_items'
import { useSubmitOrder, useArchiveOrder } from '@/hooks/use_order_mutations'
import { usePatchOrderItem } from '@/hooks/use_patch_order_item'
import type { Order } from '@/types/order'
import type { OrderItem } from '@/types/order_item'

vi.mock('@/hooks/use_order', () => ({ useOrder: vi.fn() }))
vi.mock('@/hooks/use_order_items', () => ({ useOrderItems: vi.fn() }))
vi.mock('@/hooks/use_order_mutations', () => ({
  useSubmitOrder: vi.fn(),
  useArchiveOrder: vi.fn(),
}))
vi.mock('@/hooks/use_patch_order_item', () => ({ usePatchOrderItem: vi.fn() }))

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

const itemA: OrderItem = {
  id: '00000000-0000-0000-0000-000000000010',
  order_id: mockOrder.id,
  item_id: 'SKU-001',
  item_name: 'Bark Biscuits',
  category: null,
  current_stock_qty: 0,
  velocity_tier: null,
  must_have: false,
  final_qty: 3,
  ghost_qty: null,
  confidence_tier: null,
}

const itemB: OrderItem = {
  id: '00000000-0000-0000-0000-000000000011',
  order_id: mockOrder.id,
  item_id: 'SKU-002',
  item_name: 'Dog Food 24lb',
  category: null,
  current_stock_qty: 5,
  velocity_tier: null,
  must_have: false,
  final_qty: 0,
  ghost_qty: null,
  confidence_tier: null,
}

function wrapper(id: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/orders/${id}?tab=floorwalk`]}>
        <Routes>
          <Route path="/orders/:id" element={<OrderDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Floor Walk Search & Qty Controls', () => {
  const mockPatch = vi.fn()

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
    vi.mocked(usePatchOrderItem).mockReturnValue({
      mutate: mockPatch,
      isPending: false,
    } as unknown as ReturnType<typeof usePatchOrderItem>)
    vi.mocked(useOrderItems).mockReturnValue({
      data: [itemA, itemB],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)
  })

  it('renders search bar', () => {
    render(wrapper(mockOrder.id))
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
  })

  it('filters items by search text', () => {
    render(wrapper(mockOrder.id))
    const searchInput = screen.getByPlaceholderText(/search/i)
    fireEvent.change(searchInput, { target: { value: 'bark' } })
    expect(screen.getByText('Bark Biscuits')).toBeInTheDocument()
    expect(screen.queryByText('Dog Food 24lb')).not.toBeInTheDocument()
  })

  it('shows all items when search is cleared', () => {
    render(wrapper(mockOrder.id))
    const searchInput = screen.getByPlaceholderText(/search/i)
    fireEvent.change(searchInput, { target: { value: 'bark' } })
    fireEvent.change(searchInput, { target: { value: '' } })
    expect(screen.getByText('Bark Biscuits')).toBeInTheDocument()
    expect(screen.getByText('Dog Food 24lb')).toBeInTheDocument()
  })

  it('increment + button fires mutation with final_qty + 1', () => {
    render(wrapper(mockOrder.id))
    // Bark Biscuits has final_qty=3, click + button
    const plusButtons = screen.getAllByRole('button', { name: /\+/ })
    fireEvent.click(plusButtons[0])
    expect(mockPatch).toHaveBeenCalledWith({
      orderId: mockOrder.id,
      itemId: itemA.id,
      final_qty: 4,
    })
  })

  it('decrement - button fires mutation with final_qty - 1', () => {
    render(wrapper(mockOrder.id))
    const minusButtons = screen.getAllByRole('button', { name: /-/ })
    fireEvent.click(minusButtons[0])
    expect(mockPatch).toHaveBeenCalledWith({
      orderId: mockOrder.id,
      itemId: itemA.id,
      final_qty: 2,
    })
  })

  it('cannot decrement below 0', () => {
    render(wrapper(mockOrder.id))
    // Dog Food has final_qty=0, decrement should not fire
    const minusButtons = screen.getAllByRole('button', { name: /-/ })
    fireEvent.click(minusButtons[1])
    // mockPatch should not have been called for qty 0
    const calls = mockPatch.mock.calls.filter(
      (call) => call[0].itemId === itemB.id
    )
    expect(calls.length).toBe(0)
  })
})

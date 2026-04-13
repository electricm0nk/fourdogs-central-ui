import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrderDetail } from '@/pages/OrderDetail'
import { useOrder } from '@/hooks/use_order'
import { useOrderItems } from '@/hooks/use_order_items'
import { useSubmitOrder, useArchiveOrder } from '@/hooks/use_order_mutations'
import { usePatchOrderItem } from '@/hooks/use_patch_order_item'
import { useKayleeAnalyze } from '@/hooks/use_kaylee_analyze'
import type { Order } from '@/types/order'
import type { OrderItem } from '@/types/order_item'

vi.mock('@/hooks/use_order', () => ({ useOrder: vi.fn() }))
vi.mock('@/hooks/use_order_items', () => ({ useOrderItems: vi.fn() }))
vi.mock('@/hooks/use_order_mutations', () => ({
  useSubmitOrder: vi.fn(),
  useArchiveOrder: vi.fn(),
}))
vi.mock('@/hooks/use_patch_order_item', () => ({ usePatchOrderItem: vi.fn() }))
vi.mock('@/hooks/use_kaylee_analyze', () => ({ useKayleeAnalyze: vi.fn() }))

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

const submittedOrder: Order = {
  ...mockOrder,
  submitted: true,
}

const editableItem: OrderItem = {
  id: '00000000-0000-0000-0000-000000000011',
  order_id: mockOrder.id,
  item_id: 'SKU-002',
  item_name: 'Dog Food 24lb',
  category: 'food',
  current_stock_qty: 1,
  velocity_tier: null,
  must_have: false,
  final_qty: 4,
  ghost_qty: 4,
  confidence_tier: 1,
}

function wrapChair(id: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/orders/${id}?tab=chair`]}>
        <Routes>
          <Route path="/orders/:id" element={<OrderDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('OrderingGrid — Inline Qty Editing', () => {
  const mockPatch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query.includes('1280'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    })
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
    vi.mocked(useKayleeAnalyze).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useKayleeAnalyze>)
    vi.mocked(useOrderItems).mockReturnValue({
      data: [editableItem],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)
  })

  it('clicking the final_qty cell enters edit mode and shows an input', () => {
    render(wrapChair(mockOrder.id))

    const editBtn = screen.getByRole('button', { name: /edit quantity/i })
    fireEvent.click(editBtn)

    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })

  it('Enter commits the new value and fires PATCH', () => {
    render(wrapChair(mockOrder.id))

    fireEvent.click(screen.getByRole('button', { name: /edit quantity/i }))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '7' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(mockPatch).toHaveBeenCalledWith({
      orderId: mockOrder.id,
      itemId: editableItem.id,
      final_qty: 7,
    })
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('Escape reverts without firing PATCH', () => {
    render(wrapChair(mockOrder.id))

    fireEvent.click(screen.getByRole('button', { name: /edit quantity/i }))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '9' } })
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' })

    expect(mockPatch).not.toHaveBeenCalled()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    // original value still displayed
    expect(screen.getByRole('button', { name: /edit quantity/i })).toHaveTextContent('4')
  })

  it('Tab commits the new value and fires PATCH', () => {
    render(wrapChair(mockOrder.id))

    fireEvent.click(screen.getByRole('button', { name: /edit quantity/i }))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.keyDown(input, { key: 'Tab', code: 'Tab' })

    expect(mockPatch).toHaveBeenCalledWith({
      orderId: mockOrder.id,
      itemId: editableItem.id,
      final_qty: 5,
    })
  })

  it('blur commits the new value and fires PATCH', () => {
    render(wrapChair(mockOrder.id))

    fireEvent.click(screen.getByRole('button', { name: /edit quantity/i }))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '6' } })
    fireEvent.blur(input)

    expect(mockPatch).toHaveBeenCalledWith({
      orderId: mockOrder.id,
      itemId: editableItem.id,
      final_qty: 6,
    })
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('submitted order renders final_qty as plain text — no edit button', () => {
    vi.mocked(useOrder).mockReturnValue({
      data: submittedOrder,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)

    render(wrapChair(mockOrder.id))

    expect(screen.queryByRole('button', { name: /edit quantity/i })).not.toBeInTheDocument()
    // value still visible as text
    const grid = document.querySelector('[data-testid="ordering-grid"]')
    expect(grid).toHaveTextContent('4')
  })
})

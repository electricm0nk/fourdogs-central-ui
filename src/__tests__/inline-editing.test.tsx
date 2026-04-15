import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrderingGrid } from '@/components/OrderingGrid'
import { useOrderItems } from '@/hooks/use_order_items'
import { usePatchOrderItem } from '@/hooks/use_patch_order_item'
import { useLogLearning } from '@/hooks/use_log_learning'
import type { OrderItem } from '@/types/order_item'

vi.mock('@/hooks/use_order_items', () => ({ useOrderItems: vi.fn() }))
vi.mock('@/hooks/use_patch_order_item', () => ({ usePatchOrderItem: vi.fn() }))
vi.mock('@/hooks/use_log_learning', () => ({ useLogLearning: vi.fn() }))

const ORDER_ID = '00000000-0000-0000-0000-000000000001'

const editableItem: OrderItem = {
  id: '00000000-0000-0000-0000-000000000011',
  order_id: ORDER_ID,
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

function makeGrid(isEditable: boolean) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <OrderingGrid orderId={ORDER_ID} isEditable={isEditable} />
    </QueryClientProvider>
  )
}

describe('OrderingGrid — Inline Qty Editing', () => {
  const mockPatch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(usePatchOrderItem).mockReturnValue({
      mutate: mockPatch,
      isPending: false,
    } as unknown as ReturnType<typeof usePatchOrderItem>)
    vi.mocked(useLogLearning).mockReturnValue(vi.fn())
    vi.mocked(useOrderItems).mockReturnValue({
      data: [editableItem],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)
  })

  it('clicking the final_qty cell enters edit mode and shows an input', () => {
    render(makeGrid(true))

    const editBtn = screen.getByRole('button', { name: /edit quantity/i })
    fireEvent.click(editBtn)

    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })

  it('Enter commits the new value and fires PATCH', () => {
    render(makeGrid(true))

    fireEvent.click(screen.getByRole('button', { name: /edit quantity/i }))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '7' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(mockPatch).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      itemId: editableItem.id,
      final_qty: 7,
    })
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('Escape reverts without firing PATCH', () => {
    render(makeGrid(true))

    fireEvent.click(screen.getByRole('button', { name: /edit quantity/i }))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '9' } })
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' })

    expect(mockPatch).not.toHaveBeenCalled()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit quantity/i })).toHaveTextContent('4')
  })

  it('Tab commits the new value and fires PATCH', () => {
    render(makeGrid(true))

    fireEvent.click(screen.getByRole('button', { name: /edit quantity/i }))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.keyDown(input, { key: 'Tab', code: 'Tab' })

    expect(mockPatch).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      itemId: editableItem.id,
      final_qty: 5,
    })
  })

  it('blur commits the new value and fires PATCH', () => {
    render(makeGrid(true))

    fireEvent.click(screen.getByRole('button', { name: /edit quantity/i }))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '6' } })
    fireEvent.blur(input)

    expect(mockPatch).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      itemId: editableItem.id,
      final_qty: 6,
    })
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('submitted order renders final_qty as plain text — no edit button', () => {
    render(makeGrid(false))

    expect(screen.queryByRole('button', { name: /edit quantity/i })).not.toBeInTheDocument()
    const grid = document.querySelector('[data-testid="ordering-grid"]')
    expect(grid).toHaveTextContent('4')
  })
})

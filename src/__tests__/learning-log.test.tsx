import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrderingGrid } from '@/components/OrderingGrid'
import { useOrderItems } from '@/hooks/use_order_items'
import { usePatchOrderItem } from '@/hooks/use_patch_order_item'
import { useLogLearning } from '@/hooks/use_log_learning'
import { resolveActionType } from '@/lib/resolve_action_type'
import type { OrderItem } from '@/types/order_item'

vi.mock('@/hooks/use_order_items', () => ({ useOrderItems: vi.fn() }))
vi.mock('@/hooks/use_patch_order_item', () => ({ usePatchOrderItem: vi.fn() }))
vi.mock('@/hooks/use_log_learning', () => ({ useLogLearning: vi.fn() }))

const ORDER_ID = '00000000-0000-0000-0000-000000000001'

const itemWithGhostQty: OrderItem = {
  id: '00000000-0000-0000-0000-000000000011',
  order_id: ORDER_ID,
  item_id: 'SKU-002',
  item_name: 'Dog Food 24lb',
  category: 'food',
  current_stock_qty: 1,
  velocity_tier: null,
  must_have: false,
  final_qty: 3,
  ghost_qty: 5,
  confidence_tier: 2,
  is_special_order: false,
}

const tier1Item: OrderItem = {
  ...itemWithGhostQty,
  id: '00000000-0000-0000-0000-000000000012',
  ghost_qty: 4,
  final_qty: 4,
  confidence_tier: 1,
}

function makeGrid() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <OrderingGrid orderId={ORDER_ID} isEditable={true} />
    </QueryClientProvider>
  )
}

// ─── resolveActionType unit tests ────────────────────────────────────────────

describe('resolveActionType', () => {
  it('accept_ghost when final_qty matches ghost_qty', () => {
    const item = { ghost_qty: 5, confidence_tier: 2 }
    expect(resolveActionType(item, 5)).toBe('accept_ghost')
  })

  it('override_tier1 when tier-1 and qty changed', () => {
    const item = { ghost_qty: 4, confidence_tier: 1 }
    expect(resolveActionType(item, 3)).toBe('override_tier1')
  })

  it('reject_ghost when ghost_qty set and qty differs', () => {
    const item = { ghost_qty: 5, confidence_tier: 2 }
    expect(resolveActionType(item, 3)).toBe('reject_ghost')
  })

  it('qty_edit when no ghost_qty', () => {
    const item = { ghost_qty: null, confidence_tier: null }
    expect(resolveActionType(item, 3)).toBe('qty_edit')
  })
})

// ─── Integration: fires learning after commit ─────────────────────────────────

describe('OrderingGrid — learning event integration', () => {
  const mockPatch = vi.fn()
  const mockLog = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(usePatchOrderItem).mockReturnValue({
      mutate: mockPatch,
      isPending: false,
    } as unknown as ReturnType<typeof usePatchOrderItem>)
    vi.mocked(useLogLearning).mockReturnValue(mockLog)
  })

  it('fires learning event after committing a qty edit', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [itemWithGhostQty],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    render(makeGrid())

    fireEvent.click(screen.getByRole('button', { name: /edit quantity/i }))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '3' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(mockLog).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      itemSku: 'SKU-002',
      actionType: 'reject_ghost',
      kayleeRecQty: 5,
      finalQty: 3,
      confidenceTier: 2,
    })
  })

  it('uses override_tier1 action_type for tier-1 items', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [tier1Item],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    render(makeGrid())

    fireEvent.click(screen.getByRole('button', { name: /edit quantity/i }))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '2' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'override_tier1' })
    )
  })

  it('does not fire learning on Escape (no commit)', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [itemWithGhostQty],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    render(makeGrid())

    fireEvent.click(screen.getByRole('button', { name: /edit quantity/i }))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '9' } })
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' })

    expect(mockLog).not.toHaveBeenCalled()
  })
})

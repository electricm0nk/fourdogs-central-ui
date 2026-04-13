import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
vi.mock('@/hooks/use_kaylee_stream', () => ({
  useKayleeStream: vi.fn(() => ({ tokens: [], status: 'idle', start: vi.fn() })),
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

const itemWithoutGhostQty: OrderItem = {
  id: '00000000-0000-0000-0000-000000000010',
  order_id: mockOrder.id,
  item_id: 'SKU-001',
  item_name: 'Bark Biscuits',
  category: null,
  current_stock_qty: 0,
  velocity_tier: null,
  must_have: false,
  final_qty: 0,
  ghost_qty: null,
  confidence_tier: null,
}

const itemWithGhostQty: OrderItem = {
  ...itemWithoutGhostQty,
  ghost_qty: 3,
  confidence_tier: 2,
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

describe('Kaylee Analyze — Frontend Trigger', () => {
  const mockAnalyze = vi.fn()

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
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof usePatchOrderItem>)
  })

  it('calls analyze when items have null ghost_qty', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [itemWithoutGhostQty],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)
    vi.mocked(useKayleeAnalyze).mockReturnValue({
      mutate: mockAnalyze,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useKayleeAnalyze>)

    render(wrapChair(mockOrder.id))

    expect(mockAnalyze).toHaveBeenCalledWith(mockOrder.id, expect.objectContaining({ onSuccess: expect.any(Function) }))
  })

  it('does not call analyze when all items have ghost_qty set', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [itemWithGhostQty],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)
    vi.mocked(useKayleeAnalyze).mockReturnValue({
      mutate: mockAnalyze,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useKayleeAnalyze>)

    render(wrapChair(mockOrder.id))

    expect(mockAnalyze).not.toHaveBeenCalled()
  })

  it('shows "Kaylee is thinking…" while analyze is pending', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [itemWithoutGhostQty],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)
    vi.mocked(useKayleeAnalyze).mockReturnValue({
      mutate: mockAnalyze,
      isPending: true,
      isError: false,
    } as unknown as ReturnType<typeof useKayleeAnalyze>)

    render(wrapChair(mockOrder.id))

    expect(screen.getByText(/kaylee is thinking/i)).toBeInTheDocument()
  })

  it('shows error message when analyze fails', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [itemWithoutGhostQty],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)
    vi.mocked(useKayleeAnalyze).mockReturnValue({
      mutate: mockAnalyze,
      isPending: false,
      isError: true,
    } as unknown as ReturnType<typeof useKayleeAnalyze>)

    render(wrapChair(mockOrder.id))

    expect(screen.getByText(/kaylee is unavailable/i)).toBeInTheDocument()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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
vi.mock('@/hooks/use_kaylee_stream', () => ({ useKayleeStream: vi.fn(() => ({ tokens: [], status: 'idle', start: vi.fn() })) }))
vi.mock('@/hooks/use_current_user', () => ({ useCurrentUser: vi.fn(() => ({ data: { preferences: { kaylee_mode: 'chatty', onboarding_shown: true } }, isLoading: false })) }))
vi.mock('@/hooks/use_kaylee_message', () => ({ useKayleeMessage: vi.fn(() => ({ sendMessage: vi.fn() })) }))
vi.mock('@/hooks/use_patch_preferences', () => ({ usePatchPreferences: vi.fn(() => ({ mutate: vi.fn(), isPending: false })) }))

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

const tier2Item: OrderItem = {
  id: '00000000-0000-0000-0000-000000000010',
  order_id: mockOrder.id,
  item_id: 'SKU-001',
  item_name: 'Bark Biscuits',
  category: 'snacks',
  current_stock_qty: 3,
  velocity_tier: null,
  must_have: false,
  final_qty: 0,
  ghost_qty: 5,
  confidence_tier: 2,
}

const tier1Item: OrderItem = {
  id: '00000000-0000-0000-0000-000000000011',
  order_id: mockOrder.id,
  item_id: 'SKU-002',
  item_name: 'Dog Food 24lb',
  category: 'food',
  current_stock_qty: 1,
  velocity_tier: null,
  must_have: false,
  final_qty: 4, // auto-applied from ghost_qty
  ghost_qty: 4,
  confidence_tier: 1,
}

const tier4Item: OrderItem = {
  id: '00000000-0000-0000-0000-000000000012',
  order_id: mockOrder.id,
  item_id: 'SKU-003',
  item_name: 'Cat Treats',
  category: 'treats',
  current_stock_qty: 0,
  velocity_tier: null,
  must_have: false,
  final_qty: 0,
  ghost_qty: 2,
  confidence_tier: 4,
}

const noGhostItem: OrderItem = {
  id: '00000000-0000-0000-0000-000000000013',
  order_id: mockOrder.id,
  item_id: 'SKU-004',
  item_name: 'Fish Food',
  category: null,
  current_stock_qty: 0,
  velocity_tier: null,
  must_have: false,
  final_qty: 0,
  ghost_qty: null,
  confidence_tier: null,
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

describe('OrderingGrid', () => {
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
    vi.mocked(useKayleeAnalyze).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useKayleeAnalyze>)
  })

  it('renders item name and ghost_qty for a tier-2 item', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [tier2Item],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    render(wrapChair(mockOrder.id))

    expect(screen.getByText('Bark Biscuits')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument() // ghost_qty
  })

  it('shows ConfidenceBadge for tier-2 item', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [tier2Item],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    render(wrapChair(mockOrder.id))

    expect(screen.getByText(/moderate/i)).toBeInTheDocument()
  })

  it('shows "✓ Auto" for tier-1 auto-applied item', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [tier1Item],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    render(wrapChair(mockOrder.id))

    expect(screen.getByText(/✓ auto/i)).toBeInTheDocument()
  })

  it('does not show a confidence badge for tier-1 auto-applied item', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [tier1Item],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    render(wrapChair(mockOrder.id))

    expect(screen.queryByText(/high confidence/i)).not.toBeInTheDocument()
  })

  it('shows "—" for ghost_qty when null', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [noGhostItem],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    render(wrapChair(mockOrder.id))

    // Two "—" cells: ghost_qty and confidence columns
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })

  it('shows tier-4 placeholder message in KayleePanel', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [tier4Item],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    render(wrapChair(mockOrder.id))

    expect(
      screen.getByText(/i'm not very confident about cat treats/i)
    ).toBeInTheDocument()
  })

  it('renders all column headers', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    render(wrapChair(mockOrder.id))

    const grid = screen.getByTestId('ordering-grid')
    expect(within(grid).getByText(/item/i)).toBeInTheDocument()
    expect(within(grid).getByText(/ghost qty/i)).toBeInTheDocument()
    expect(within(grid).getByText(/confidence/i)).toBeInTheDocument()
    expect(within(grid).getByText(/final qty/i)).toBeInTheDocument()
  })
})

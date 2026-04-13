import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrderingGrid } from '@/components/OrderingGrid'
import { KayleePanel } from '@/components/KayleePanel'
import { useOrderItems } from '@/hooks/use_order_items'
import { usePatchOrderItem } from '@/hooks/use_patch_order_item'
import { useLogLearning } from '@/hooks/use_log_learning'
import { useKayleeAnalyze } from '@/hooks/use_kaylee_analyze'
import type { OrderItem } from '@/types/order_item'

vi.mock('@/hooks/use_order_items', () => ({ useOrderItems: vi.fn() }))
vi.mock('@/hooks/use_patch_order_item', () => ({ usePatchOrderItem: vi.fn() }))
vi.mock('@/hooks/use_log_learning', () => ({ useLogLearning: vi.fn() }))
vi.mock('@/hooks/use_kaylee_analyze', () => ({ useKayleeAnalyze: vi.fn() }))
vi.mock('@/hooks/use_kaylee_stream', () => ({ useKayleeStream: vi.fn(() => ({ tokens: [], status: 'idle', start: vi.fn() })) }))
vi.mock('@/hooks/use_current_user', () => ({ useCurrentUser: vi.fn(() => ({ data: { preferences: { kaylee_mode: 'chatty', onboarding_shown: true } }, isLoading: false })) }))
vi.mock('@/hooks/use_kaylee_message', () => ({ useKayleeMessage: vi.fn(() => ({ sendMessage: vi.fn() })) }))
vi.mock('@/hooks/use_patch_preferences', () => ({ usePatchPreferences: vi.fn(() => ({ mutate: vi.fn(), isPending: false })) }))

const ORDER_ID = '00000000-0000-0000-0000-000000000001'

const tier2Item: OrderItem = {
  id: '00000000-0000-0000-0000-000000000010',
  order_id: ORDER_ID,
  item_id: 'SKU-001',
  item_name: 'Bark Biscuits',
  category: 'snacks',
  current_stock_qty: 3,
  velocity_tier: null,
  must_have: false,
  final_qty: 0,
  ghost_qty: 5,
  confidence_tier: 2,
  is_special_order: false,
}

const tier1Item: OrderItem = {
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
  is_special_order: false,
}

const tier4Item: OrderItem = {
  id: '00000000-0000-0000-0000-000000000012',
  order_id: ORDER_ID,
  item_id: 'SKU-003',
  item_name: 'Cat Treats',
  category: 'treats',
  current_stock_qty: 0,
  velocity_tier: null,
  must_have: false,
  final_qty: 0,
  ghost_qty: 2,
  confidence_tier: 4,
  is_special_order: false,
}

const noGhostItem: OrderItem = {
  id: '00000000-0000-0000-0000-000000000013',
  order_id: ORDER_ID,
  item_id: 'SKU-004',
  item_name: 'Fish Food',
  category: null,
  current_stock_qty: 0,
  velocity_tier: null,
  must_have: false,
  final_qty: 0,
  ghost_qty: null,
  confidence_tier: null,
  is_special_order: false,
}

const specialOrderItem: OrderItem = {
  id: '00000000-0000-0000-0000-000000000014',
  order_id: mockOrder.id,
  item_id: 'SKU-SPECIAL',
  item_name: 'Exotic Cat Food 6lb',
  category: null,
  current_stock_qty: 0,
  velocity_tier: null,
  must_have: false,
  final_qty: 2,
  ghost_qty: null,
  confidence_tier: null,
  is_special_order: true,
}

function makeGrid(isEditable = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <OrderingGrid orderId={ORDER_ID} isEditable={isEditable} />
    </QueryClientProvider>
  )
}

function makeKaylee() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <KayleePanel orderId={ORDER_ID} />
    </QueryClientProvider>
  )
}

describe('OrderingGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(usePatchOrderItem).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof usePatchOrderItem>)
    vi.mocked(useLogLearning).mockReturnValue(vi.fn())
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

    render(makeGrid())

    expect(screen.getByText('Bark Biscuits')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument() // ghost_qty
  })

  it('shows ConfidenceBadge for tier-2 item', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [tier2Item],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    render(makeGrid())

    expect(screen.getByText(/moderate/i)).toBeInTheDocument()
  })

  it('shows "✓ Auto" for tier-1 auto-applied item', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [tier1Item],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    render(makeGrid())

    expect(screen.getByText(/✓ auto/i)).toBeInTheDocument()
  })

  it('does not show a confidence badge for tier-1 auto-applied item', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [tier1Item],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    render(makeGrid())

    expect(screen.queryByText(/high confidence/i)).not.toBeInTheDocument()
  })

  it('shows "—" for ghost_qty when null', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [noGhostItem],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    render(makeGrid())

    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })

  it('shows tier-4 placeholder message in KayleePanel', () => {
    vi.mocked(useOrderItems).mockReturnValue({
      data: [tier4Item],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    render(makeKaylee())

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

    render(makeGrid())

    const grid = screen.getByTestId('ordering-grid')
    expect(within(grid).getByText(/item/i)).toBeInTheDocument()
    expect(within(grid).getByText(/ghost qty/i)).toBeInTheDocument()
    expect(within(grid).getByText(/confidence/i)).toBeInTheDocument()
    expect(within(grid).getByText(/final qty/i)).toBeInTheDocument()
  })
})

describe('Special Order badge in OrderingGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useOrder).mockReturnValue({ data: mockOrder, isLoading: false, error: null } as unknown as ReturnType<typeof useOrder>)
    vi.mocked(useSubmitOrder).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useSubmitOrder>)
    vi.mocked(useArchiveOrder).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useArchiveOrder>)
    vi.mocked(usePatchOrderItem).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof usePatchOrderItem>)
    vi.mocked(useKayleeAnalyze).mockReturnValue({ mutate: vi.fn(), isPending: false, data: undefined } as unknown as ReturnType<typeof useKayleeAnalyze>)
  })

  it('shows "Special Order" badge for is_special_order items', () => {
    vi.mocked(useOrderItems).mockReturnValue({ data: [specialOrderItem], isLoading: false } as unknown as ReturnType<typeof useOrderItems>)
    render(wrapChair(mockOrder.id))

    expect(screen.getByText('Special Order')).toBeInTheDocument()
  })

  it('does not show "Special Order" badge for regular items', () => {
    vi.mocked(useOrderItems).mockReturnValue({ data: [tier2Item], isLoading: false } as unknown as ReturnType<typeof useOrderItems>)
    render(wrapChair(mockOrder.id))

    expect(screen.queryByText('Special Order')).not.toBeInTheDocument()
  })
})

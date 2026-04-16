import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { KayleePanel } from '@/components/KayleePanel'
import { useOrderItems } from '@/hooks/use_order_items'
import { useKayleeAnalyze } from '@/hooks/use_kaylee_analyze'
import type { OrderItem } from '@/types/order_item'

vi.mock('@/hooks/use_order_items', () => ({ useOrderItems: vi.fn() }))
vi.mock('@/hooks/use_kaylee_analyze', () => ({ useKayleeAnalyze: vi.fn() }))
vi.mock('@/hooks/use_kaylee_stream', () => ({
  useKayleeStream: vi.fn(() => ({ tokens: [], status: 'idle', start: vi.fn() })),
}))
vi.mock('@/hooks/use_current_user', () => ({
  useCurrentUser: vi.fn(() => ({
    data: { preferences: { kaylee_mode: 'chatty', onboarding_shown: true } },
    isLoading: false,
  })),
}))
vi.mock('@/hooks/use_kaylee_message', () => ({ useKayleeMessage: vi.fn(() => ({ sendMessage: vi.fn() })) }))
vi.mock('@/hooks/use_patch_preferences', () => ({ usePatchPreferences: vi.fn(() => ({ mutate: vi.fn(), isPending: false })) }))

const ORDER_ID = '00000000-0000-0000-0000-000000000001'

const itemWithoutGhostQty: OrderItem = {
  id: '00000000-0000-0000-0000-000000000010',
  order_id: ORDER_ID,
  item_id: 'SKU-001',
  item_name: 'Bark Biscuits',
  category: null,
  current_stock_qty: 0,
  velocity_tier: null,
  must_have: false,
  final_qty: 0,
  ghost_qty: null,
  confidence_tier: null,
  is_special_order: false,
}

const itemWithGhostQty: OrderItem = {
  ...itemWithoutGhostQty,
  ghost_qty: 3,
  confidence_tier: 2,
}

function makeKaylee() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <KayleePanel orderId={ORDER_ID} />
    </QueryClientProvider>
  )
}

describe('Kaylee Analyze — Frontend Trigger', () => {
  const mockAnalyze = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
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

    render(makeKaylee())

    expect(mockAnalyze).toHaveBeenCalledWith(ORDER_ID, expect.objectContaining({ onSuccess: expect.any(Function) }))
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

    render(makeKaylee())

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

    render(makeKaylee())

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

    render(makeKaylee())

    expect(screen.getByText(/kaylee is unavailable/i)).toBeInTheDocument()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrderingGrid } from '@/components/OrderingGrid'
import { KayleePanel } from '@/components/KayleePanel'
import { ConfidenceBadge } from '@/components/ConfidenceBadge'
import { useOrderItems } from '@/hooks/use_order_items'
import { usePatchOrderItem } from '@/hooks/use_patch_order_item'
import { useLogLearning } from '@/hooks/use_log_learning'
import { useKayleeAnalyze } from '@/hooks/use_kaylee_analyze'
import { useKayleeStream } from '@/hooks/use_kaylee_stream'

vi.mock('@/hooks/use_order_items', () => ({ useOrderItems: vi.fn() }))
vi.mock('@/hooks/use_patch_order_item', () => ({ usePatchOrderItem: vi.fn() }))
vi.mock('@/hooks/use_log_learning', () => ({ useLogLearning: vi.fn() }))
vi.mock('@/hooks/use_kaylee_analyze', () => ({ useKayleeAnalyze: vi.fn() }))
vi.mock('@/hooks/use_kaylee_stream', () => ({ useKayleeStream: vi.fn(() => ({ tokens: [], status: 'idle', start: vi.fn() })) }))
vi.mock('@/hooks/use_current_user', () => ({ useCurrentUser: vi.fn(() => ({ data: { preferences: { kaylee_mode: 'chatty', onboarding_shown: true } }, isLoading: false })) }))
vi.mock('@/hooks/use_kaylee_message', () => ({ useKayleeMessage: vi.fn(() => ({ sendMessage: vi.fn() })) }))
vi.mock('@/hooks/use_patch_preferences', () => ({ usePatchPreferences: vi.fn(() => ({ mutate: vi.fn(), isPending: false })) }))

const ORDER_ID = '00000000-0000-0000-0000-000000000001'

function makeGrid() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <OrderingGrid orderId={ORDER_ID} isEditable={true} />
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

describe('Chair Phase Layout Shell', () => {
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
    vi.mocked(useOrderItems).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)
  })

  it('renders ordering grid region', () => {
    render(makeGrid())
    expect(screen.getByTestId('ordering-grid')).toBeInTheDocument()
  })

  it('renders Kaylee panel region', () => {
    render(makeKaylee())
    expect(screen.getByTestId('kaylee-panel')).toBeInTheDocument()
  })

  it('Kaylee panel shows thinking state while analyzing', () => {
    vi.mocked(useKayleeAnalyze).mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
      isError: false,
    } as unknown as ReturnType<typeof useKayleeAnalyze>)
    vi.mocked(useOrderItems).mockReturnValue({
      data: [{ id: 'x', order_id: ORDER_ID, item_id: 'S', item_name: 'X', category: null, current_stock_qty: 0, velocity_tier: null, must_have: false, final_qty: 0, ghost_qty: null, confidence_tier: null }],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)
    render(makeKaylee())
    expect(screen.getByText(/kaylee is thinking/i)).toBeInTheDocument()
  })
})

describe('ConfidenceBadge', () => {
  it('renders Tier 1 as High Confidence in green', () => {
    render(<ConfidenceBadge tier={1} />)
    const badge = screen.getByText(/high confidence/i)
    expect(badge).toBeInTheDocument()
    expect(badge.className).toMatch(/green/)
  })

  it('renders Tier 2 as Moderate in blue', () => {
    render(<ConfidenceBadge tier={2} />)
    const badge = screen.getByText(/moderate/i)
    expect(badge).toBeInTheDocument()
    expect(badge.className).toMatch(/blue/)
  })

  it('renders Tier 3 as Review in amber', () => {
    render(<ConfidenceBadge tier={3} />)
    const badge = screen.getByText(/review/i)
    expect(badge).toBeInTheDocument()
    expect(badge.className).toMatch(/amber/)
  })

  it('renders Tier 4 as Low Confidence in red', () => {
    render(<ConfidenceBadge tier={4} />)
    const badge = screen.getByText(/low confidence/i)
    expect(badge).toBeInTheDocument()
    expect(badge.className).toMatch(/red/)
  })
})

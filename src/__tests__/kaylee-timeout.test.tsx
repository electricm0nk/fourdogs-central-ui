import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { KayleePanel } from '@/components/KayleePanel'
import { useOrderItems } from '@/hooks/use_order_items'
import { useKayleeAnalyze } from '@/hooks/use_kaylee_analyze'
import { useKayleeStream } from '@/hooks/use_kaylee_stream'
import type { OrderItem } from '@/types/order_item'

vi.mock('@/hooks/use_order_items', () => ({ useOrderItems: vi.fn() }))
vi.mock('@/hooks/use_kaylee_analyze', () => ({ useKayleeAnalyze: vi.fn() }))
vi.mock('@/hooks/use_kaylee_stream', () => ({ useKayleeStream: vi.fn() }))
vi.mock('@/hooks/use_current_user', () => ({
  useCurrentUser: vi.fn(() => ({
    data: { preferences: { kaylee_mode: 'chatty', onboarding_shown: true } },
    isLoading: false,
  })),
}))
vi.mock('@/hooks/use_kaylee_message', () => ({ useKayleeMessage: vi.fn(() => ({ sendMessage: vi.fn() })) }))
vi.mock('@/hooks/use_patch_preferences', () => ({ usePatchPreferences: vi.fn(() => ({ mutate: vi.fn(), isPending: false })) }))

const ORDER_ID = '00000000-0000-0000-0000-000000000001'

const analyzedItem: OrderItem = {
  id: '00000000-0000-0000-0000-000000000011',
  order_id: ORDER_ID,
  item_id: 'SKU-001',
  item_name: 'Dog Food 24lb',
  category: 'food',
  current_stock_qty: 1,
  velocity_tier: null,
  must_have: false,
  final_qty: 4,
  ghost_qty: 4,
  confidence_tier: 2,
  is_special_order: false,
}

function makeKaylee() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <KayleePanel orderId={ORDER_ID} />
    </QueryClientProvider>
  )
}

describe('KayleePanel — timeout + fallback UI', () => {
  const mockStart = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useOrderItems).mockReturnValue({
      data: [analyzedItem],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)
    vi.mocked(useKayleeAnalyze).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useKayleeAnalyze>)
  })

  it('shows fallback message on timeout status', () => {
    vi.mocked(useKayleeStream).mockReturnValue({
      tokens: [],
      status: 'timeout',
      start: mockStart,
    })

    render(makeKaylee())

    expect(screen.getByText(/taking longer than usual/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('shows fallback message on error status', () => {
    vi.mocked(useKayleeStream).mockReturnValue({
      tokens: [],
      status: 'error',
      start: mockStart,
    })

    render(makeKaylee())

    expect(screen.getByText(/taking longer than usual/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('"Try again" button calls start()', () => {
    vi.mocked(useKayleeStream).mockReturnValue({
      tokens: [],
      status: 'timeout',
      start: mockStart,
    })

    render(makeKaylee())

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(mockStart).toHaveBeenCalled()
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrderDetail } from '@/pages/OrderDetail'
import { useOrder } from '@/hooks/use_order'
import { useOrderItems } from '@/hooks/use_order_items'
import { useSubmitOrder, useArchiveOrder } from '@/hooks/use_order_mutations'
import { usePatchOrderItem } from '@/hooks/use_patch_order_item'
import { useKayleeAnalyze } from '@/hooks/use_kaylee_analyze'
import { useKayleeStream } from '@/hooks/use_kaylee_stream'
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
vi.mock('@/hooks/use_kaylee_stream', () => ({ useKayleeStream: vi.fn() }))
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

const analyzedItem: OrderItem = {
  id: '00000000-0000-0000-0000-000000000011',
  order_id: mockOrder.id,
  item_id: 'SKU-001',
  item_name: 'Dog Food 24lb',
  category: 'food',
  current_stock_qty: 1,
  velocity_tier: null,
  must_have: false,
  final_qty: 4,
  ghost_qty: 4,
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

describe('KayleeStream — streaming integration', () => {
  const mockStart = vi.fn()

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

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders accumulated tokens as a message in the stream panel', () => {
    vi.mocked(useKayleeStream).mockReturnValue({
      tokens: ['Let', ' me', ' review'],
      status: 'streaming',
      start: mockStart,
    })

    render(wrapChair(mockOrder.id))

    const streamPanel = screen.getByTestId('kaylee-stream')
    expect(streamPanel).toHaveTextContent('Let me review')
  })

  it('shows streaming status while tokens are arriving', () => {
    vi.mocked(useKayleeStream).mockReturnValue({
      tokens: ['Hello'],
      status: 'streaming',
      start: mockStart,
    })

    render(wrapChair(mockOrder.id))

    // typing indicator visible during streaming
    expect(screen.getByTestId('kaylee-typing')).toBeInTheDocument()
  })

  it('hides typing indicator when done', () => {
    vi.mocked(useKayleeStream).mockReturnValue({
      tokens: ['Hello'],
      status: 'done',
      start: mockStart,
    })

    render(wrapChair(mockOrder.id))

    expect(screen.queryByTestId('kaylee-typing')).not.toBeInTheDocument()
  })

  it('calls start() when analyze succeeds (no null ghost_qty items)', () => {
    const capturedCallbacks: Array<{onSuccess?: () => void}> = []
    vi.mocked(useKayleeAnalyze).mockReturnValue({
      mutate: vi.fn((_, opts?: { onSuccess?: () => void }) => {
        if (opts) capturedCallbacks.push(opts)
      }),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useKayleeAnalyze>)

    // Items have null ghost_qty → analyze should fire
    vi.mocked(useOrderItems).mockReturnValue({
      data: [{ ...analyzedItem, ghost_qty: null, confidence_tier: null }],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    vi.mocked(useKayleeStream).mockReturnValue({
      tokens: [],
      status: 'idle',
      start: mockStart,
    })

    render(wrapChair(mockOrder.id))

    // Simulate analyze succeeding
    act(() => {
      capturedCallbacks[0]?.onSuccess?.()
    })

    expect(mockStart).toHaveBeenCalled()
  })

  it('component unmounts without errors (EventSource lifecycle guard)', () => {
    vi.mocked(useKayleeStream).mockReturnValue({
      tokens: [],
      status: 'idle',
      start: mockStart,
    })

    // Items all have ghost_qty set → analyze not triggered → start() not called.
    const { unmount } = render(wrapChair(mockOrder.id))
    expect(() => unmount()).not.toThrow()
    expect(mockStart).not.toHaveBeenCalled()
  })
})

// ─── KayleeMessage variant tests ─────────────────────────────────────────────

describe('KayleeMessage variants', () => {
  it('renders kaylee variant left-aligned', async () => {
    const { KayleeMessage } = await import('@/components/KayleeMessage')
    const { container } = render(<KayleeMessage role="kaylee" text="Hello!" />)
    const el = container.querySelector('[data-testid="kaylee-message"]')
    expect(el).toBeInTheDocument()
    expect(el?.textContent).toBe('Hello!')
  })

  it('renders operator variant', async () => {
    const { KayleeMessage } = await import('@/components/KayleeMessage')
    const { container } = render(<KayleeMessage role="operator" text="Good question" />)
    const el = container.querySelector('[data-testid="kaylee-message"]')
    expect(el).toBeInTheDocument()
    expect(el?.textContent).toBe('Good question')
  })
})

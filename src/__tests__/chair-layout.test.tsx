import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrderDetail } from '@/pages/OrderDetail'
import { useOrder } from '@/hooks/use_order'
import { useOrderItems } from '@/hooks/use_order_items'
import { useSubmitOrder, useArchiveOrder } from '@/hooks/use_order_mutations'
import { usePatchOrderItem } from '@/hooks/use_patch_order_item'
import { ConfidenceBadge } from '@/components/ConfidenceBadge'
import type { Order } from '@/types/order'

vi.mock('@/hooks/use_order', () => ({ useOrder: vi.fn() }))
vi.mock('@/hooks/use_order_items', () => ({ useOrderItems: vi.fn() }))
vi.mock('@/hooks/use_order_mutations', () => ({
  useSubmitOrder: vi.fn(),
  useArchiveOrder: vi.fn(),
}))
vi.mock('@/hooks/use_patch_order_item', () => ({ usePatchOrderItem: vi.fn() }))

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

function wrapWithTab(id: string, tab: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/orders/${id}?tab=${tab}`]}>
        <Routes>
          <Route path="/orders/:id" element={<OrderDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Chair Phase Layout Shell', () => {
  beforeEach(() => {
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
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders Chair Phase tab in the tab bar', () => {
    render(wrapWithTab(mockOrder.id, 'floorwalk'))
    expect(screen.getByRole('tab', { name: /chair/i })).toBeInTheDocument()
  })

  it('renders ordering grid region when chair tab is active', () => {
    render(wrapWithTab(mockOrder.id, 'chair'))
    expect(screen.getByTestId('ordering-grid')).toBeInTheDocument()
  })

  it('renders Kaylee panel region when chair tab is active on wide viewport', () => {
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
    render(wrapWithTab(mockOrder.id, 'chair'))
    expect(screen.getByTestId('kaylee-panel')).toBeInTheDocument()
  })

  it('hides Kaylee panel on narrow viewport', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false, // below 1280px
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    })
    render(wrapWithTab(mockOrder.id, 'chair'))
    expect(screen.queryByTestId('kaylee-panel')).not.toBeInTheDocument()
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

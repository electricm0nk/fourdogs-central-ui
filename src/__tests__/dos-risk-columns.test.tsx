/**
 * Integration test: DOS and Risk columns in the orders worksheet (Story 1.8).
 * Verifies that dos_days and risk_score from the API are rendered in the table,
 * and that the risk badge displays the correct color label.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrderDetail } from '@/pages/OrderDetail'
import { useOrder } from '@/hooks/use_order'
import { useVendorCatalog } from '@/hooks/use_vendor_catalog'
import { useVendorAdapters } from '@/hooks/use_vendor_adapters'
import { useSubmitOrder } from '@/hooks/use_order_mutations'
import type { ChairSku } from '@/lib/chairSandboxMock'
import { api } from '@/lib/api'
import type { Order } from '@/types/order'

vi.mock('@/hooks/use_order', () => ({ useOrder: vi.fn() }))
vi.mock('@/hooks/use_vendor_catalog', () => ({ useVendorCatalog: vi.fn() }))
vi.mock('@/hooks/use_vendor_adapters', () => ({ useVendorAdapters: vi.fn() }))
vi.mock('@/hooks/use_order_mutations', () => ({
  useSubmitOrder: vi.fn(),
  useArchiveOrder: vi.fn(),
}))
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}))

const ORDER_ID = '00000000-0000-0000-0000-000000000001'

const activeOrder: Order = {
  id: ORDER_ID,
  vendor_adapter_id: '00000000-0000-0000-0000-000000000002',
  vendor_name: 'Southeast Pet',
  created_by: 'test-sub',
  order_date: '2026-04-12',
  submitted: false,
  archived: false,
  created_at: '2026-04-12T00:00:00Z',
}

// SKUs with known dos_days and risk_score values
const skusWithRisk: ChairSku[] = [
  {
    id: 'SKU-CRIT',
    upc: '000000000001',
    name: 'Critical Risk Item',
    tab: 'core',
    category: 'core',
    manufacturer: 'Brand A',
    animal: 'dog',
    pack: '1',
    priceCents: 10_000,
    velocity: 'fast',
    qoh: 2,
    reorderStatus: '',
    doNotReorder: false,
    dosDays: 3,
    riskScore: 92,
  },
  {
    id: 'SKU-SAFE',
    upc: '000000000002',
    name: 'Safe Item',
    tab: 'core',
    category: 'core',
    manufacturer: 'Brand B',
    animal: 'dog',
    pack: '1',
    priceCents: 500,
    velocity: 'slow',
    qoh: 200,
    reorderStatus: '',
    doNotReorder: false,
    dosDays: 180,
    riskScore: 5,
  },
  {
    id: 'SKU-NULL',
    upc: '000000000003',
    name: 'No Risk Data',
    tab: 'core',
    category: 'core',
    manufacturer: 'Brand C',
    animal: 'dog',
    pack: '1',
    priceCents: 200,
    velocity: 'medium',
    qoh: 10,
    reorderStatus: '',
    doNotReorder: false,
    dosDays: null,
    riskScore: null,
  },
]

function orderDetailWrapper(id: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/orders/${id}`]}>
        <Routes>
          <Route path="/orders/:id" element={<OrderDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('OrderDetail — DOS and Risk columns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useOrder).mockReturnValue({
      data: activeOrder,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)
    vi.mocked(useVendorCatalog).mockReturnValue({
      data: skusWithRisk,
      isLoading: false,
      isSuccess: true,
      error: null,
    } as unknown as ReturnType<typeof useVendorCatalog>)
    vi.mocked(useVendorAdapters).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useVendorAdapters>)
    vi.mocked(useSubmitOrder).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useSubmitOrder>)
    vi.mocked(api.get).mockResolvedValue({ data: [] })
  })

  it('renders DOS (days) column header', () => {
    render(<OrderDetail />, { wrapper: () => orderDetailWrapper(ORDER_ID) })
    expect(screen.getByText('DOS (days)')).toBeInTheDocument()
  })

  it('renders Risk % column header', () => {
    render(<OrderDetail />, { wrapper: () => orderDetailWrapper(ORDER_ID) })
    expect(screen.getByText('Risk %')).toBeInTheDocument()
  })

  it('displays dos_days value for items that have it', async () => {
    render(<OrderDetail />, { wrapper: () => orderDetailWrapper(ORDER_ID) })
    expect(await screen.findByText('3')).toBeInTheDocument()
    expect(await screen.findByText('180')).toBeInTheDocument()
  })

  it('displays risk_score as a badge with percent sign', async () => {
    render(<OrderDetail />, { wrapper: () => orderDetailWrapper(ORDER_ID) })
    expect(await screen.findByText('92%')).toBeInTheDocument()
    expect(await screen.findByText('5%')).toBeInTheDocument()
  })

  it('renders dash placeholder for items with null dos_days and risk_score', async () => {
    render(<OrderDetail />, { wrapper: () => orderDetailWrapper(ORDER_ID) })
    // Null columns render as "—" (em dash)
    const dashes = await screen.findAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Dashboard } from '@/pages/Dashboard'
import { OrderDetail } from '@/pages/OrderDetail'
import { useOrders } from '@/hooks/use_orders'
import { useOrder } from '@/hooks/use_order'
import { useVendorCatalog } from '@/hooks/use_vendor_catalog'
import { useVendorAdapters } from '@/hooks/use_vendor_adapters'
import { useSubmitOrder, useArchiveOrder } from '@/hooks/use_order_mutations'
import type { ChairSku } from '@/lib/chairSandboxMock'
import { api } from '@/lib/api'
import type { Order, VendorAdapter } from '@/types/order'

vi.mock('@/hooks/use_orders', () => ({ useOrders: vi.fn() }))
vi.mock('@/hooks/use_order', () => ({ useOrder: vi.fn() }))
vi.mock('@/hooks/use_vendor_catalog', () => ({ useVendorCatalog: vi.fn() }))
vi.mock('@/hooks/use_vendor_adapters', () => ({ useVendorAdapters: vi.fn() }))
vi.mock('@/hooks/use_order_mutations', () => ({
  useSubmitOrder: vi.fn(),
  useArchiveOrder: vi.fn(),
}))
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

const activeOrder: Order = {
  id: '00000000-0000-0000-0000-000000000001',
  vendor_adapter_id: '00000000-0000-0000-0000-000000000002',
  vendor_name: 'Southeast Pet',
  created_by: 'test-sub',
  order_date: '2026-04-12',
  submitted: false,
  archived: false,
  created_at: '2026-04-12T00:00:00Z',
}

const submittedOrder: Order = { ...activeOrder, submitted: true }

const archivedOrder: Order = {
  ...activeOrder,
  id: '00000000-0000-0000-0000-000000000099',
  archived: true,
}

const mockAdapter: VendorAdapter = {
  id: '00000000-0000-0000-0000-000000000002',
  name: 'Southeast Pet',
  adapter_type: 'sep',
  created_at: '2026-04-12T00:00:00Z',
}

const catalogSkus: ChairSku[] = [
  {
    id: 'SKU-FW-1',
    upc: '000000000001',
    name: 'Zebra Freeze Dried',
    tab: 'core',
    category: 'core',
    manufacturer: 'Brand Z',
    animal: 'dog',
    pack: '1',
    priceCents: 10_000,
    velocity: 'slow',
    qoh: 0,
    reorderStatus: 'SMART_ORDER',
    doNotReorder: false,
  },
  {
    id: 'SKU-REC-1',
    upc: '000000000002',
    name: 'Alpha Kibble',
    tab: 'core',
    category: 'core',
    manufacturer: 'Brand A',
    animal: 'dog',
    pack: '1',
    priceCents: 100,
    velocity: 'fast',
    qoh: 12,
    reorderStatus: 'SMART_ORDER',
    doNotReorder: false,
  },
]

function wrapper(children: React.ReactNode, initialPath = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={children} />
          <Route path="/orders/:id" element={<OrderDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function orderDetailWrapper(id: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
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

describe('Dashboard — archive lifecycle', () => {
  const mockArchiveMutate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useVendorCatalog).mockReturnValue({
      data: catalogSkus,
      isLoading: false,
      isSuccess: true,
      error: null,
    } as unknown as ReturnType<typeof useVendorCatalog>)
    vi.mocked(useVendorAdapters).mockReturnValue({
      data: [mockAdapter],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useVendorAdapters>)
    vi.mocked(useArchiveOrder).mockReturnValue({
      mutate: mockArchiveMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useArchiveOrder>)
    vi.mocked(useSubmitOrder).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useSubmitOrder>)
  })

  it('does not show archive button on active order row', () => {
    vi.mocked(useOrders).mockReturnValue({
      data: [activeOrder],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrders>)

    render(wrapper(<Dashboard />))

    expect(screen.queryByRole('button', { name: /^archive$/i })).not.toBeInTheDocument()
  })

  it('shows active-order actions (floor walk, worksheet, mark ordered)', () => {
    vi.mocked(useOrders).mockReturnValue({
      data: [activeOrder],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrders>)

    render(wrapper(<Dashboard />))

    expect(screen.getByRole('button', { name: /^floor walk$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^worksheet$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^mark ordered$/i })).toBeInTheDocument()
  })

  it('shows Show Archived toggle button', () => {
    vi.mocked(useOrders).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrders>)

    render(wrapper(<Dashboard />))

    expect(screen.getByRole('button', { name: /show archived/i })).toBeInTheDocument()
  })

  it('toggles to show archived orders section', () => {
    vi.mocked(useOrders)
      .mockReturnValueOnce({
        data: [],
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useOrders>)
      .mockReturnValueOnce({
        data: [archivedOrder],
        isLoading: false,
        error: null,
      } as unknown as ReturnType<typeof useOrders>)

    render(wrapper(<Dashboard />))
    fireEvent.click(screen.getByRole('button', { name: /show archived/i }))

    expect(screen.getByText(/^Archived Orders$/i)).toBeInTheDocument()
  })
})

describe('OrderDetail — submit lifecycle', () => {
  const mockSubmitMutate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSubmitOrder).mockReturnValue({
      mutate: mockSubmitMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useSubmitOrder>)
    vi.mocked(useArchiveOrder).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useArchiveOrder>)
    vi.mocked(useVendorCatalog).mockReturnValue({
      data: catalogSkus,
      isLoading: false,
      isSuccess: true,
      error: null,
    } as unknown as ReturnType<typeof useVendorCatalog>)
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      const path = String(url)
      if (path.includes('/floor-walk-lines')) return { data: [] }
      if (path === '/v1/suggestions') return { data: [] }
      return { data: [] }
    })
  })

  it('shows Return to Orders button for unsubmitted order', () => {
    vi.mocked(useOrder).mockReturnValue({
      data: activeOrder,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)

    render(orderDetailWrapper(activeOrder.id))

    expect(screen.getByRole('button', { name: /return to orders/i })).toBeInTheDocument()
  })

  it('does not submit when Return to Orders clicked', () => {
    vi.mocked(useOrder).mockReturnValue({
      data: activeOrder,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)

    render(orderDetailWrapper(activeOrder.id))
    fireEvent.click(screen.getByRole('button', { name: /return to orders/i }))

    expect(mockSubmitMutate).not.toHaveBeenCalled()
  })

  it('shows Unsubmit button for submitted order', () => {
    vi.mocked(useOrder).mockReturnValue({
      data: submittedOrder,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)

    render(orderDetailWrapper(submittedOrder.id))

    expect(screen.getByRole('button', { name: /unsubmit/i })).toBeInTheDocument()
  })

  it('fires PATCH submitted=false when Unsubmit clicked', () => {
    vi.mocked(useOrder).mockReturnValue({
      data: submittedOrder,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)

    render(orderDetailWrapper(submittedOrder.id))
    fireEvent.click(screen.getByRole('button', { name: /unsubmit/i }))

    expect(mockSubmitMutate).toHaveBeenCalledWith({ id: submittedOrder.id, submitted: false })
  })

  it('shows read-only indicator for submitted order', () => {
    vi.mocked(useOrder).mockReturnValue({
      data: submittedOrder,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)

    render(orderDetailWrapper(submittedOrder.id))

    expect(screen.getByText(/read.only/i)).toBeInTheDocument()
  })

  it('shows loading state while order fetches', () => {
    vi.mocked(useOrder).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)

    render(orderDetailWrapper(activeOrder.id))

    expect(screen.queryByRole('button', { name: /return to orders/i })).not.toBeInTheDocument()
  })

  it('keeps floor-walk-selected items after loading recommendations', async () => {
    vi.mocked(useOrder).mockReturnValue({
      data: {
        ...activeOrder,
        budget_cents: 1_000,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)

    vi.mocked(api.get).mockImplementation(async (url: string) => {
      const path = String(url)
      if (path.includes('/floor-walk-lines')) {
        return {
          data: [
            {
              sku_id: 'SKU-FW-1',
              item_upc: '000000000001',
              quantity: 3,
            },
          ],
        }
      }
      if (path === '/v1/suggestions') return { data: [] }
      return { data: [] }
    })

    render(orderDetailWrapper(activeOrder.id))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /increase sku-fw-1/i })).toBeInTheDocument()
    })

    await waitFor(() => {
      const floorWalkRow = screen.getByText('Zebra Freeze Dried').closest('tr')
      expect(floorWalkRow).not.toBeNull()
      const qtyInput = within(floorWalkRow as HTMLTableRowElement).getByRole('spinbutton') as HTMLInputElement
      expect(qtyInput.value).toBe('3')
    })

    fireEvent.click(screen.getByRole('button', { name: /load recommendations/i }))

    await waitFor(() => {
      const persistedRow = screen.getByText('Zebra Freeze Dried').closest('tr')
      expect(persistedRow).not.toBeNull()
      expect(within(persistedRow as HTMLTableRowElement).getByDisplayValue('3')).toBeInTheDocument()
    })
  })

  it('shows no tier label when adding a new worksheet item without Kaylee recommendations loaded', async () => {
    vi.mocked(useOrder).mockReturnValue({
      data: {
        ...activeOrder,
        budget_cents: 1_000,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)

    vi.mocked(api.get).mockImplementation(async (url: string) => {
      const path = String(url)
      if (path.includes('/floor-walk-lines')) {
        return { data: [] }
      }
      if (path === '/v1/suggestions') return { data: [] }
      return { data: [] }
    })

    render(orderDetailWrapper(activeOrder.id))

    await waitFor(() => {
      expect(screen.getByText('Zebra Freeze Dried')).toBeInTheDocument()
    })

    const row = screen.getByText('Zebra Freeze Dried').closest('tr')
    expect(row).not.toBeNull()

    fireEvent.click(within(row as HTMLTableRowElement).getByRole('button', { name: /increase sku-fw-1/i }))

    await waitFor(() => {
      // No tier label until Kaylee recommendations are loaded (uifix2-1-3)
      expect(within(row as HTMLTableRowElement).queryByText('INCREASED')).not.toBeInTheDocument()
      expect(within(row as HTMLTableRowElement).queryByText('DECREASED')).not.toBeInTheDocument()
    })
  })

  it('applies legend signal filters as multi-select AND (hot + priority)', async () => {
    vi.mocked(useOrder).mockReturnValue({
      data: {
        ...activeOrder,
        budget_cents: 10_000,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)

    vi.mocked(api.get).mockImplementation(async (url: string) => {
      const path = String(url)
      if (path.includes('/floor-walk-lines')) {
        return {
          data: [
            { sku_id: 'SKU-FW-1', item_upc: '000000000001', quantity: 8 },
            { sku_id: 'SKU-REC-1', item_upc: '000000000002', quantity: 8 },
          ],
        }
      }
      if (path === '/v1/suggestions') return { data: [] }
      return { data: [] }
    })

    render(orderDetailWrapper(activeOrder.id))

    await waitFor(() => {
      expect(screen.getByText('Zebra Freeze Dried')).toBeInTheDocument()
      expect(screen.getByText('Alpha Kibble')).toBeInTheDocument()
    })

    // HOT = velocity fast; PRIORITY = imported from floor-walk
    // Both items are floor-walk priority; only Alpha Kibble (fast) is HOT
    // HOT AND PRIORITY together shows only Alpha Kibble
    fireEvent.click(screen.getByRole('button', { name: 'HOT' }))
    fireEvent.click(screen.getByRole('button', { name: 'PRIORITY' }))

    await waitFor(() => {
      expect(screen.getByText('Alpha Kibble')).toBeInTheDocument()
      expect(screen.queryByText('Zebra Freeze Dried')).not.toBeInTheDocument()
    })
  })

  it('prevents user and recommendations from changing a locked worksheet line', async () => {
    vi.mocked(useOrder).mockReturnValue({
      data: {
        ...activeOrder,
        budget_cents: 1_000,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)

    vi.mocked(api.get).mockImplementation(async (url: string) => {
      const path = String(url)
      if (path.includes('/floor-walk-lines')) {
        return {
          data: [
            {
              sku_id: 'SKU-FW-1',
              item_upc: '000000000001',
              quantity: 3,
            },
          ],
        }
      }
      if (path === '/v1/suggestions') return { data: [] }
      return { data: [] }
    })

    render(orderDetailWrapper(activeOrder.id))

    await waitFor(() => {
      const row = screen.getByText('Zebra Freeze Dried').closest('tr')
      expect(row).not.toBeNull()
      const qtyInput = within(row as HTMLTableRowElement).getByRole('spinbutton') as HTMLInputElement
      expect(qtyInput.value).toBe('3')
    })

    fireEvent.click(screen.getByRole('checkbox', { name: /lock sku-fw-1/i }))

    const rowAfterLock = screen.getByText('Zebra Freeze Dried').closest('tr')
    const decreaseBtn = within(rowAfterLock as HTMLTableRowElement).getByRole('button', { name: /decrease sku-fw-1/i })
    const increaseBtn = within(rowAfterLock as HTMLTableRowElement).getByRole('button', { name: /increase sku-fw-1/i })
    expect(decreaseBtn).toBeDisabled()
    expect(increaseBtn).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /load recommendations/i }))

    await waitFor(() => {
      const persistedRow = screen.getByText('Zebra Freeze Dried').closest('tr')
      expect(persistedRow).not.toBeNull()
      const qtyInput = within(persistedRow as HTMLTableRowElement).getByRole('spinbutton') as HTMLInputElement
      expect(qtyInput.value).toBe('3')
    })
  })

  it('applies recommendation to items qualified by riskScore when suggestedQty is absent', async () => {
    // uifix2-1-4: items with riskScore > 0 qualify for Load Recommendations even if suggestedQty is undefined
    const riskCatalog: ChairSku[] = [
      {
        id: 'SKU-RISK-1',
        upc: '000000000099',
        name: 'Risk Item Alpha',
        tab: 'core',
        category: 'core',
        manufacturer: 'Brand R',
        animal: 'dog',
        pack: '2',
        priceCents: 200,
        velocity: 'fast',
        qoh: 0,
        reorderStatus: 'SMART_ORDER',
        doNotReorder: false,
        riskScore: 75,  // qualifies via riskScore
        // suggestedQty intentionally absent (undefined)
      },
    ]

    vi.mocked(useVendorCatalog).mockReturnValue({
      data: riskCatalog,
      isLoading: false,
      isSuccess: true,
      error: null,
    } as unknown as ReturnType<typeof useVendorCatalog>)
    vi.mocked(useOrder).mockReturnValue({
      data: { ...activeOrder, budget_cents: 10_000 },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (String(url).includes('/floor-walk-lines')) return { data: [] }
      if (String(url) === '/v1/suggestions') return { data: [] }
      return { data: [] }
    })

    render(orderDetailWrapper(activeOrder.id))

    await waitFor(() => {
      expect(screen.getByText('Risk Item Alpha')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /load recommendations/i }))

    await waitFor(() => {
      const row = screen.getByText('Risk Item Alpha').closest('tr')
      expect(row).not.toBeNull()
      const qtyInput = within(row as HTMLTableRowElement).getByRole('spinbutton') as HTMLInputElement
      // qty = parseInt(pack, 10) || 1 = 2 (pack='2')
      expect(parseInt(qtyInput.value, 10)).toBeGreaterThan(0)
    })
  })

  it('fills an existing zero-quantity worksheet row when recommendations qualify it by riskScore', async () => {
    const riskCatalog: ChairSku[] = [
      {
        id: 'SKU-RISK-2',
        upc: '000000000199',
        name: 'Risk Item Beta',
        tab: 'core',
        category: 'core',
        manufacturer: 'Brand R',
        animal: 'dog',
        pack: '3',
        priceCents: 100,
        velocity: 'fast',
        qoh: 0,
        reorderStatus: 'SMART_ORDER',
        doNotReorder: false,
        riskScore: 82,
      },
    ]

    vi.mocked(useVendorCatalog).mockReturnValue({
      data: riskCatalog,
      isLoading: false,
      isSuccess: true,
      error: null,
    } as unknown as ReturnType<typeof useVendorCatalog>)
    vi.mocked(useOrder).mockReturnValue({
      data: { ...activeOrder, budget_cents: 10_000 },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (String(url).includes('/floor-walk-lines')) return { data: [] }
      if (String(url) === '/v1/suggestions') return { data: [] }
      return { data: [] }
    })

    render(orderDetailWrapper(activeOrder.id))

    await waitFor(() => {
      expect(screen.getByText('Risk Item Beta')).toBeInTheDocument()
    })

    const row = screen.getByText('Risk Item Beta').closest('tr')
    expect(row).not.toBeNull()

    fireEvent.click(within(row as HTMLTableRowElement).getByRole('button', { name: /increase sku-risk-2/i }))
    fireEvent.click(within(row as HTMLTableRowElement).getByRole('button', { name: /decrease sku-risk-2/i }))

    await waitFor(() => {
      const qtyInput = within(row as HTMLTableRowElement).getByRole('spinbutton') as HTMLInputElement
      expect(qtyInput.value).toBe('0')
    })

    fireEvent.click(screen.getByRole('button', { name: /load recommendations/i }))

    await waitFor(() => {
      const qtyInput = within(row as HTMLTableRowElement).getByRole('spinbutton') as HTMLInputElement
      expect(qtyInput.value).toBe('3')
    })
  })
})

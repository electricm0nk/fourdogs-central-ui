import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FloorWalk } from '@/pages/FloorWalk'
import { useOrder } from '@/hooks/use_order'
import { useVendorCatalog } from '@/hooks/use_vendor_catalog'
import { api } from '@/lib/api'
import type { Order } from '@/types/order'
import type { ChairSku } from '@/lib/chairSandboxMock'

vi.mock('@/hooks/use_order', () => ({ useOrder: vi.fn() }))
vi.mock('@/hooks/use_vendor_catalog', () => ({ useVendorCatalog: vi.fn() }))
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
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

const catalogSkus: ChairSku[] = [
  {
    id: 'SKU-001',
    upc: '000000000001',
    name: 'Bark Biscuits',
    tab: 'core',
    category: 'snacks',
    manufacturer: 'Brand A',
    animal: 'dog',
    pack: '1',
    priceCents: 500,
    velocity: 'fast',
    qoh: 0,
    reorderStatus: 'SMART_ORDER',
    doNotReorder: false,
  },
  {
    id: 'SKU-002',
    upc: '000000000002',
    name: 'Dog Food 24lb',
    tab: 'core',
    category: 'food',
    manufacturer: 'Brand B',
    animal: 'dog',
    pack: '1',
    priceCents: 2000,
    velocity: 'slow',
    qoh: 5,
    reorderStatus: 'SMART_ORDER',
    doNotReorder: false,
  },
]

function wrapper(id: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/orders/${id}/floor-walk`]}>
        <Routes>
          <Route path="/orders/:id/floor-walk" element={<FloorWalk />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Floor Walk Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    vi.mocked(api.post).mockResolvedValue({ data: {} })
  })

  it('shows Floor Walk page heading', async () => {
    vi.mocked(useOrder).mockReturnValue({
      data: mockOrder,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)
    vi.mocked(useVendorCatalog).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useVendorCatalog>)

    render(wrapper(mockOrder.id))

    await waitFor(() => expect(screen.getByText('Floor Walk')).toBeInTheDocument())
  })

  it('renders item list from catalog', async () => {
    vi.mocked(useOrder).mockReturnValue({
      data: mockOrder,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)
    vi.mocked(useVendorCatalog).mockReturnValue({
      data: catalogSkus,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useVendorCatalog>)

    render(wrapper(mockOrder.id))

    await waitFor(() => {
      expect(screen.getByText('Bark Biscuits')).toBeInTheDocument()
      expect(screen.getByText('Dog Food 24lb')).toBeInTheDocument()
    })
  })

  it('shows increase/decrease buttons for each item', async () => {
    vi.mocked(useOrder).mockReturnValue({
      data: mockOrder,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)
    vi.mocked(useVendorCatalog).mockReturnValue({
      data: catalogSkus,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useVendorCatalog>)

    render(wrapper(mockOrder.id))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /increase sku-001/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /decrease sku-001/i })).toBeInTheDocument()
    })
  })

  it('shows loading state while order loads', () => {
    vi.mocked(useOrder).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)
    vi.mocked(useVendorCatalog).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useVendorCatalog>)

    render(wrapper(mockOrder.id))

    expect(screen.getByText(/loading floor walk/i)).toBeInTheDocument()
  })

  it('shows zero-catalog message when catalog returns empty', async () => {
    vi.mocked(useOrder).mockReturnValue({
      data: mockOrder,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)
    vi.mocked(useVendorCatalog).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useVendorCatalog>)

    render(wrapper(mockOrder.id))

    await waitFor(() => expect(screen.getByText(/live catalog returned zero items/i)).toBeInTheDocument())
  })

  it('priority badge uses server floor-walk data, not local qty state', async () => {
    // uifix2-1-2: prioritySkuIds must derive from floorWalkLinesQuery.data, not lineItems
    vi.mocked(useOrder).mockReturnValue({
      data: mockOrder,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)
    vi.mocked(useVendorCatalog).mockReturnValue({
      data: catalogSkus,
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useVendorCatalog>)
    // Only SKU-001 is a floor-walk server item (qty=3 saved)
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (String(url).includes('/floor-walk-lines')) {
        return { data: [{ sku_id: 'SKU-001', item_upc: '000000000001', quantity: 3 }] }
      }
      return { data: [] }
    })

    render(wrapper(mockOrder.id))

    await waitFor(() => {
      expect(screen.getAllByText('Bark Biscuits').length).toBeGreaterThan(0)
      expect(screen.getByText('Dog Food 24lb')).toBeInTheDocument()
    })

    // Find the row in the main catalog table (not the cart summary)
    const barkCells = screen.getAllByText('Bark Biscuits')
    const barkRow = barkCells.map((el) => el.closest('tr')).find((row) => row !== null)
    const dogFoodRow = screen.getByText('Dog Food 24lb').closest('tr')
    expect(barkRow).not.toBeNull()
    expect(dogFoodRow).not.toBeNull()

    // SKU-001 (Bark Biscuits) is in server floor-walk-lines → priority badge applied
    expect(barkRow?.className).toContain('fuchsia')
    // SKU-002 (Dog Food) is NOT in server floor-walk-lines → no priority badge
    expect(dogFoodRow?.className).not.toContain('fuchsia')
  })
})

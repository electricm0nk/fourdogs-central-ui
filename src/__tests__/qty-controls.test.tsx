import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
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

describe('Floor Walk Search & Qty Controls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    vi.mocked(api.put).mockResolvedValue({ data: {} })
  })

  it('renders search bar', async () => {
    render(wrapper(mockOrder.id))
    await waitFor(() => expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument())
  })

  it('filters items by search text', async () => {
    render(wrapper(mockOrder.id))
    await waitFor(() => expect(screen.getByText('Bark Biscuits')).toBeInTheDocument())

    const searchInput = screen.getByPlaceholderText(/search/i)
    fireEvent.change(searchInput, { target: { value: 'bark' } })
    expect(screen.getByText('Bark Biscuits')).toBeInTheDocument()
    expect(screen.queryByText('Dog Food 24lb')).not.toBeInTheDocument()
  })

  it('shows all items when search is cleared', async () => {
    render(wrapper(mockOrder.id))
    await waitFor(() => expect(screen.getByText('Bark Biscuits')).toBeInTheDocument())

    const searchInput = screen.getByPlaceholderText(/search/i)
    fireEvent.change(searchInput, { target: { value: 'bark' } })
    fireEvent.change(searchInput, { target: { value: '' } })
    expect(screen.getByText('Bark Biscuits')).toBeInTheDocument()
    expect(screen.getByText('Dog Food 24lb')).toBeInTheDocument()
  })

  it('increment + button increases qty from 0 to 1', async () => {
    render(wrapper(mockOrder.id))
    await waitFor(() => expect(screen.getByText('Bark Biscuits')).toBeInTheDocument())

    const row = screen.getByText('Bark Biscuits').closest('tr')
    expect(row).not.toBeNull()

    fireEvent.click(within(row as HTMLTableRowElement).getByRole('button', { name: /increase sku-001/i }))

    const qtyInput = within(row as HTMLTableRowElement).getAllByRole('spinbutton')[1] as HTMLInputElement
    expect(qtyInput.value).toBe('1')
  })

  it('decrement - button decreases qty', async () => {
    render(wrapper(mockOrder.id))
    await waitFor(() => expect(screen.getByText('Bark Biscuits')).toBeInTheDocument())

    const row = screen.getByText('Bark Biscuits').closest('tr')
    expect(row).not.toBeNull()

    // First increment to 1 so we have something to decrement
    fireEvent.click(within(row as HTMLTableRowElement).getByRole('button', { name: /increase sku-001/i }))
    fireEvent.click(within(row as HTMLTableRowElement).getByRole('button', { name: /decrease sku-001/i }))

    const qtyInput = within(row as HTMLTableRowElement).getAllByRole('spinbutton')[1] as HTMLInputElement
    expect(qtyInput.value).toBe('0')
  })

  it('cannot decrement below 0', async () => {
    render(wrapper(mockOrder.id))
    await waitFor(() => expect(screen.getByText('Bark Biscuits')).toBeInTheDocument())

    const row = screen.getByText('Bark Biscuits').closest('tr')
    expect(row).not.toBeNull()

    // Qty starts at 0 — decrement should stay at 0
    fireEvent.click(within(row as HTMLTableRowElement).getByRole('button', { name: /decrease sku-001/i }))

    const qtyInput = within(row as HTMLTableRowElement).getAllByRole('spinbutton')[1] as HTMLInputElement
    expect(qtyInput.value).toBe('0')
  })
})

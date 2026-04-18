/**
 * Tests for velocity wiring version display (Story 1.10).
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
import { useVersions } from '@/hooks/use_versions'
import { formatWiringVersion } from '@/hooks/use_versions'
import { api } from '@/lib/api'
import type { Order } from '@/types/order'

vi.mock('@/hooks/use_order', () => ({ useOrder: vi.fn() }))
vi.mock('@/hooks/use_vendor_catalog', () => ({ useVendorCatalog: vi.fn() }))
vi.mock('@/hooks/use_vendor_adapters', () => ({ useVendorAdapters: vi.fn() }))
vi.mock('@/hooks/use_order_mutations', () => ({
  useSubmitOrder: vi.fn(),
  useArchiveOrder: vi.fn(),
}))
vi.mock('@/hooks/use_versions', () => ({
  useVersions: vi.fn(),
  formatWiringVersion: vi.fn(),
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

// --- formatWiringVersion unit tests ---

describe('formatWiringVersion', () => {
  beforeEach(() => {
    vi.mocked(formatWiringVersion).mockRestore?.()
    // Use the real implementation (not mocked) for these tests
    vi.importActual('@/hooks/use_versions').then((m: Record<string, unknown>) => {
      vi.mocked(formatWiringVersion).mockImplementation(m.formatWiringVersion as typeof formatWiringVersion)
    })
  })

  it('returns velocity version as string when kaylee_version is null', async () => {
    const { formatWiringVersion: real } = await vi.importActual<typeof import('@/hooks/use_versions')>('@/hooks/use_versions')
    expect(real({ velocity_version: 3, kaylee_version: null })).toBe('3')
  })

  it('returns paired format when kaylee_version is present', async () => {
    const { formatWiringVersion: real } = await vi.importActual<typeof import('@/hooks/use_versions')>('@/hooks/use_versions')
    expect(real({ velocity_version: 18, kaylee_version: 1 })).toBe('18.1')
  })

  it('returns empty string for undefined data', async () => {
    const { formatWiringVersion: real } = await vi.importActual<typeof import('@/hooks/use_versions')>('@/hooks/use_versions')
    expect(real(undefined)).toBe('')
  })
})

// --- UI rendering tests ---

describe('OrderDetail — velocity version display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useOrder).mockReturnValue({
      data: activeOrder,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrder>)
    vi.mocked(useVendorCatalog).mockReturnValue({
      data: [],
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

  it('displays velocity version in header when available', async () => {
    vi.mocked(useVersions).mockReturnValue({
      data: { velocity_version: 3, kaylee_version: null },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useVersions>)
    vi.mocked(formatWiringVersion).mockReturnValue('3')

    render(<OrderDetail />, { wrapper: () => orderDetailWrapper(ORDER_ID) })
    expect(await screen.findByText('v3')).toBeInTheDocument()
  })

  it('displays paired version format when kaylee_version is present', async () => {
    vi.mocked(useVersions).mockReturnValue({
      data: { velocity_version: 18, kaylee_version: 1 },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useVersions>)
    vi.mocked(formatWiringVersion).mockReturnValue('18.1')

    render(<OrderDetail />, { wrapper: () => orderDetailWrapper(ORDER_ID) })
    expect(await screen.findByText('v18.1')).toBeInTheDocument()
  })

  it('does not render version badge when data is unavailable', async () => {
    vi.mocked(useVersions).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useVersions>)
    vi.mocked(formatWiringVersion).mockReturnValue('')

    render(<OrderDetail />, { wrapper: () => orderDetailWrapper(ORDER_ID) })
    // version display should not be present
    expect(screen.queryByText(/^v\d/)).toBeNull()
  })
})

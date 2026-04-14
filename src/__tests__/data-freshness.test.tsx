import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DataFreshnessPanel } from '@/components/DataFreshnessPanel'
import { useDataFreshness } from '@/hooks/use_data_freshness'
import type { DataFreshnessResponse } from '@/types/data_freshness'

vi.mock('@/hooks/use_data_freshness', () => ({ useDataFreshness: vi.fn() }))

const freshData: DataFreshnessResponse = {
  inventory: {
    updated_at: '2026-04-12T09:00:00Z',
    age_minutes: 14,
    stale: false,
    threshold_seconds: 86400,
  },
  sales: {
    updated_at: '2026-04-12T09:45:00Z',
    age_minutes: 5,
    stale: false,
    threshold_seconds: 7200,
  },
}

const staleData: DataFreshnessResponse = {
  inventory: {
    updated_at: '2026-04-11T09:00:00Z',
    age_minutes: 1454,
    stale: true,
    threshold_seconds: 86400,
  },
  sales: {
    updated_at: '2026-04-12T09:45:00Z',
    age_minutes: 5,
    stale: false,
    threshold_seconds: 7200,
  },
}

function wrapper(children: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('DataFreshnessPanel', () => {
  const mockRefetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state while fetching', () => {
    vi.mocked(useDataFreshness).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useDataFreshness>)

    render(wrapper(<DataFreshnessPanel />))

    expect(screen.getByText(/\.\.\. loading/i)).toBeInTheDocument()
  })

  it('shows inventory freshness with checkmark when fresh', () => {
    vi.mocked(useDataFreshness).mockReturnValue({
      data: freshData,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useDataFreshness>)

    render(wrapper(<DataFreshnessPanel />))

    expect(screen.getByText(/inventory/i)).toBeInTheDocument()
    expect(screen.getByText(/14 minutes ago/i)).toBeInTheDocument()
    expect(screen.getAllByText('✓').length).toBeGreaterThan(0)
  })

  it('shows warning indicator for stale inventory', () => {
    vi.mocked(useDataFreshness).mockReturnValue({
      data: staleData,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useDataFreshness>)

    render(wrapper(<DataFreshnessPanel />))

    expect(screen.getByText('⚠')).toBeInTheDocument()
  })

  it('shows Refresh button', () => {
    vi.mocked(useDataFreshness).mockReturnValue({
      data: freshData,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useDataFreshness>)

    render(wrapper(<DataFreshnessPanel />))

    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
  })

  it('calls refetch when Refresh is clicked', () => {
    vi.mocked(useDataFreshness).mockReturnValue({
      data: freshData,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useDataFreshness>)

    render(wrapper(<DataFreshnessPanel />))
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))

    expect(mockRefetch).toHaveBeenCalledOnce()
  })

  it('shows degraded message when endpoint unavailable', () => {
    vi.mocked(useDataFreshness).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useDataFreshness>)

    render(wrapper(<DataFreshnessPanel />))

    expect(screen.getByText(/data freshness check unavailable/i)).toBeInTheDocument()
  })

  it('formats hours when age exceeds 60 minutes', () => {
    const hourOldData: DataFreshnessResponse = {
      ...freshData,
      inventory: { ...freshData.inventory, age_minutes: 860, stale: true },
    }
    vi.mocked(useDataFreshness).mockReturnValue({
      data: hourOldData,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useDataFreshness>)

    render(wrapper(<DataFreshnessPanel />))

    expect(screen.getByText(/14 hours ago/i)).toBeInTheDocument()
  })
})

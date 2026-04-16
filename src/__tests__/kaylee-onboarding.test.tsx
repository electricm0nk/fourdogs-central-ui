import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { KayleePanel } from '@/components/KayleePanel'
import { useOrderItems } from '@/hooks/use_order_items'
import { useKayleeAnalyze } from '@/hooks/use_kaylee_analyze'
import { useKayleeStream } from '@/hooks/use_kaylee_stream'
import { useCurrentUser } from '@/hooks/use_current_user'
import { useKayleeMessage } from '@/hooks/use_kaylee_message'
import { usePatchPreferences } from '@/hooks/use_patch_preferences'
import type { OrderItem } from '@/types/order_item'
import type { User } from '@/hooks/use_current_user'

vi.mock('@/hooks/use_order_items', () => ({ useOrderItems: vi.fn() }))
vi.mock('@/hooks/use_kaylee_analyze', () => ({ useKayleeAnalyze: vi.fn() }))
vi.mock('@/hooks/use_kaylee_stream', () => ({ useKayleeStream: vi.fn() }))
vi.mock('@/hooks/use_current_user', () => ({ useCurrentUser: vi.fn() }))
vi.mock('@/hooks/use_kaylee_message', () => ({ useKayleeMessage: vi.fn() }))
vi.mock('@/hooks/use_patch_preferences', () => ({ usePatchPreferences: vi.fn() }))

const testOrderId = '00000000-0000-0000-0000-000000000001'

const analyzedItem: OrderItem = {
  id: '00000000-0000-0000-0000-000000000011',
  order_id: testOrderId,
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

const firstTimeUser: User = {
  google_sub: 'sub-123',
  email: 'operator@test.com',
  name: 'Operator',
  preferences: { kaylee_mode: 'chatty', onboarding_shown: false },
}

const returningUser: User = {
  ...firstTimeUser,
  preferences: { kaylee_mode: 'chatty', onboarding_shown: true },
}

function wrap() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <KayleePanel orderId={testOrderId} />
    </QueryClientProvider>
  )
}

describe('KayleePanel — onboarding intro', () => {
  const mockAnalyzeMutate = vi.fn()
  const mockPatchMutate = vi.fn()
  const mockStart = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useOrderItems).mockReturnValue({
      data: [analyzedItem],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)
    vi.mocked(useKayleeAnalyze).mockReturnValue({
      mutate: mockAnalyzeMutate,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useKayleeAnalyze>)
    vi.mocked(useKayleeStream).mockReturnValue({
      tokens: [],
      status: 'idle',
      start: mockStart,
    })
    vi.mocked(useKayleeMessage).mockReturnValue({
      sendMessage: vi.fn(),
    })
    vi.mocked(usePatchPreferences).mockReturnValue({
      mutate: mockPatchMutate,
      isPending: false,
    } as unknown as ReturnType<typeof usePatchPreferences>)
  })

  it('shows intro message when onboarding_shown is false', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: firstTimeUser,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUser>)

    render(wrap())

    expect(screen.getByText(/Hi! I'm Kaylee/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /got it/i })).toBeInTheDocument()
  })

  it('does not show intro for returning user (onboarding_shown: true)', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: returningUser,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUser>)

    render(wrap())

    expect(screen.queryByText(/Hi! I'm Kaylee/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /got it/i })).not.toBeInTheDocument()
  })

  it('"Got it" fires PATCH with onboarding_shown: true', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: firstTimeUser,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUser>)

    render(wrap())

    fireEvent.click(screen.getByRole('button', { name: /got it/i }))

    expect(mockPatchMutate).toHaveBeenCalledWith(
      expect.objectContaining({ onboarding_shown: true }),
    )
  })

  it('"Got it" hides intro and starts analyze', async () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: firstTimeUser,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUser>)
    // Items have null ghost_qty so analyze would normally fire — but we're blocking it with onboarding
    vi.mocked(useOrderItems).mockReturnValue({
      data: [{ ...analyzedItem, ghost_qty: null, confidence_tier: null }],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    render(wrap())

    expect(screen.getByText(/Hi! I'm Kaylee/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /got it/i }))

    await waitFor(() => {
      expect(screen.queryByText(/Hi! I'm Kaylee/i)).not.toBeInTheDocument()
    })
  })

  it('analyze does not auto-start while intro is visible', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: firstTimeUser,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUser>)
    // Items have null ghost_qty which would normally trigger analyze
    vi.mocked(useOrderItems).mockReturnValue({
      data: [{ ...analyzedItem, ghost_qty: null, confidence_tier: null }],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrderItems>)

    render(wrap())

    // Analyze should NOT have been called while intro is visible
    expect(mockAnalyzeMutate).not.toHaveBeenCalled()
  })
})

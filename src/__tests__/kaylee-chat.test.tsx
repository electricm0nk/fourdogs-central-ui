import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { KayleePanel } from '@/components/KayleePanel'
import { useOrderItems } from '@/hooks/use_order_items'
import { useKayleeAnalyze } from '@/hooks/use_kaylee_analyze'
import { useKayleeStream } from '@/hooks/use_kaylee_stream'
import { useCurrentUser } from '@/hooks/use_current_user'
import { useKayleeMessage } from '@/hooks/use_kaylee_message'
import type { OrderItem } from '@/types/order_item'
import type { User } from '@/hooks/use_current_user'

vi.mock('@/hooks/use_order_items', () => ({ useOrderItems: vi.fn() }))
vi.mock('@/hooks/use_kaylee_analyze', () => ({ useKayleeAnalyze: vi.fn() }))
vi.mock('@/hooks/use_kaylee_stream', () => ({ useKayleeStream: vi.fn() }))
vi.mock('@/hooks/use_current_user', () => ({ useCurrentUser: vi.fn() }))
vi.mock('@/hooks/use_kaylee_message', () => ({ useKayleeMessage: vi.fn() }))

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
}

const chattyUser: User = {
  google_sub: 'sub-123',
  email: 'operator@test.com',
  name: 'Operator',
  preferences: { kaylee_mode: 'chatty' },
}

const sleepyUser: User = {
  ...chattyUser,
  preferences: { kaylee_mode: 'sleepy' },
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

describe('KayleePanel — chat messages', () => {
  const mockStart = vi.fn()
  const mockSendMessage = vi.fn()

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
    vi.mocked(useCurrentUser).mockReturnValue({
      data: chattyUser,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUser>)
    vi.mocked(useKayleeMessage).mockReturnValue({
      sendMessage: mockSendMessage,
    })
  })

  it('shows chat input when stream is done and mode is chatty', () => {
    vi.mocked(useKayleeStream).mockReturnValue({
      tokens: ['Hello'],
      status: 'done',
      start: mockStart,
    })

    render(wrap())

    expect(screen.getByPlaceholderText(/ask kaylee/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('send button is disabled when draft is empty', () => {
    vi.mocked(useKayleeStream).mockReturnValue({
      tokens: [],
      status: 'done',
      start: mockStart,
    })

    render(wrap())

    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('send button is disabled during streaming', () => {
    vi.mocked(useKayleeStream).mockReturnValue({
      tokens: ['Let me'],
      status: 'streaming',
      start: mockStart,
    })

    render(wrap())

    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('input is disabled during streaming', () => {
    vi.mocked(useKayleeStream).mockReturnValue({
      tokens: ['Let me'],
      status: 'streaming',
      start: mockStart,
    })

    render(wrap())

    expect(screen.getByPlaceholderText(/ask kaylee/i)).toBeDisabled()
  })

  it('submitting form calls sendMessage with draft text', async () => {
    mockSendMessage.mockResolvedValue('msg_token_abc')
    vi.mocked(useKayleeStream).mockReturnValue({
      tokens: [],
      status: 'done',
      start: mockStart,
    })

    render(wrap())

    const input = screen.getByPlaceholderText(/ask kaylee/i)
    fireEvent.change(input, { target: { value: 'Why is Dog Food at Tier 3?' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith('Why is Dog Food at Tier 3?')
    })
  })

  it('operator message bubble renders after successful send', async () => {
    mockSendMessage.mockResolvedValue('msg_token_abc')
    vi.mocked(useKayleeStream).mockReturnValue({
      tokens: [],
      status: 'done',
      start: mockStart,
    })

    render(wrap())

    const input = screen.getByPlaceholderText(/ask kaylee/i)
    fireEvent.change(input, { target: { value: 'Why is Dog Food at Tier 3?' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(screen.getByText('Why is Dog Food at Tier 3?')).toBeInTheDocument()
    })
  })

  it('sleepy mode hides chat input and shows mode message', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: sleepyUser,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUser>)
    vi.mocked(useKayleeStream).mockReturnValue({
      tokens: [],
      status: 'done',
      start: mockStart,
    })

    render(wrap())

    expect(screen.queryByPlaceholderText(/ask kaylee/i)).not.toBeInTheDocument()
    expect(screen.getByText(/sleepy mode/i)).toBeInTheDocument()
  })
})

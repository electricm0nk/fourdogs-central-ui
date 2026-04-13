import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { KaylaeModeToggle } from '@/components/KaylaeModeToggle'
import { useCurrentUser } from '@/hooks/use_current_user'
import { usePatchPreferences } from '@/hooks/use_patch_preferences'
import type { User } from '@/hooks/use_current_user'

vi.mock('@/hooks/use_current_user', () => ({ useCurrentUser: vi.fn() }))
vi.mock('@/hooks/use_patch_preferences', () => ({ usePatchPreferences: vi.fn() }))

const chattyUser: User = {
  google_sub: 'sub123',
  email: 'test@example.com',
  name: 'test',
  preferences: { kaylee_mode: 'chatty' },
}

const sleepyUser: User = {
  ...chattyUser,
  preferences: { kaylee_mode: 'sleepy' },
}

function wrapper(children: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('KaylaeModeToggle', () => {
  const mockMutate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(usePatchPreferences).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof usePatchPreferences>)
  })

  it('shows Chatty when kaylee_mode is chatty', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: chattyUser,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUser>)

    render(wrapper(<KaylaeModeToggle />))

    expect(screen.getByText(/chatty/i)).toBeInTheDocument()
  })

  it('shows Sleepy when kaylee_mode is sleepy', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: sleepyUser,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUser>)

    render(wrapper(<KaylaeModeToggle />))

    expect(screen.getByText(/sleepy/i)).toBeInTheDocument()
  })

  it('calls mutate with sleepy when chatty toggle clicked', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: chattyUser,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUser>)

    render(wrapper(<KaylaeModeToggle />))
    fireEvent.click(screen.getByRole('button'))

    expect(mockMutate).toHaveBeenCalledWith({ kaylee_mode: 'sleepy' })
  })

  it('calls mutate with chatty when sleepy toggle clicked', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: sleepyUser,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUser>)

    render(wrapper(<KaylaeModeToggle />))
    fireEvent.click(screen.getByRole('button'))

    expect(mockMutate).toHaveBeenCalledWith({ kaylee_mode: 'chatty' })
  })

  it('renders nothing while loading', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUser>)

    const { container } = render(wrapper(<KaylaeModeToggle />))

    expect(container.firstChild).toBeNull()
  })
})

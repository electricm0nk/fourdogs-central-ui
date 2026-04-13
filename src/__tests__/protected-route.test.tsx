import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ApiError } from '@/lib/api'

// Mock useCurrentUser hook
vi.mock('@/hooks/use_current_user', () => ({
  useCurrentUser: vi.fn(),
}))

import { useCurrentUser } from '@/hooks/use_current_user'

function wrapper(children: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={children} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders children when user is authenticated', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: { google_sub: 'sub123', email: 'test@example.com', name: 'Test' },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUser>)

    render(
      wrapper(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('shows loading state while auth check is in flight', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useCurrentUser>)

    render(
      wrapper(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )
    )

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('redirects to /login on 401 error', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new ApiError(401, 'Unauthorized'),
    } as unknown as ReturnType<typeof useCurrentUser>)

    render(
      wrapper(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )
    )

    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('redirects to /login on parse-like session errors', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new SyntaxError('Unexpected token < in JSON at position 0'),
    } as unknown as ReturnType<typeof useCurrentUser>)

    render(
      wrapper(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )
    )

    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})

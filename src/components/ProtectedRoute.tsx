import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useCurrentUser } from '@/hooks/use_current_user'
import { ApiError } from '@/lib/api'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { data: user, isLoading, error } = useCurrentUser()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    return <Navigate to="/login" replace />
  }

  const likelyAuthResponseError =
    error instanceof SyntaxError ||
    (error instanceof Error && /unexpected token|json/i.test(error.message))

  if (likelyAuthResponseError) {
    return <Navigate to="/login" replace />
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-lg border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-red-700">Failed to load session.</p>
          <p className="mt-1 text-sm text-gray-600">Your session may have expired or the network request failed.</p>
          <div className="mt-4 flex gap-2">
            <a
              href="/login"
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Sign in again
            </a>
            <button
              type="button"
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
              onClick={() => window.location.reload()}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!user) return null

  return <>{children}</>
}

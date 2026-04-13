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

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/login" replace />
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">Failed to load session. Please refresh.</p>
      </div>
    )
  }

  if (!user) return null

  return <>{children}</>
}

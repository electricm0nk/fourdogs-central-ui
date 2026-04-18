import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router'
import { LoginPage } from '@/pages/LoginPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'

// Heavy pages — loaded only when their route is first visited
const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })))
const OrderDetail = lazy(() => import('@/pages/OrderDetail').then(m => ({ default: m.OrderDetail })))
const FloorWalk = lazy(() => import('@/pages/FloorWalk').then(m => ({ default: m.FloorWalk })))
const ChairSandbox = lazy(() => import('@/pages/ChairSandbox').then(m => ({ default: m.ChairSandbox })))
const SpecialOrders = lazy(() => import('@/pages/SpecialOrders').then(m => ({ default: m.SpecialOrders })))

// Root layout — wraps all routes
function RootLayout() {
  return (
    <Suspense fallback={<div className="p-4 text-gray-400">Loading…</div>}>
      <Outlet />
    </Suspense>
  )
}

function NotFound() {
  return <div className="p-4">404 — Page not found</div>
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'orders/:id',
        element: (
          <ProtectedRoute>
            <OrderDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: 'orders/:id/floor-walk',
        element: (
          <ProtectedRoute>
            <FloorWalk />
          </ProtectedRoute>
        ),
      },
      {
        path: 'special-orders',
        element: (
          <ProtectedRoute>
            <SpecialOrders />
          </ProtectedRoute>
        ),
      },
      { path: 'sandbox/chair', element: <ChairSandbox /> },
      { path: 'login', element: <LoginPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App

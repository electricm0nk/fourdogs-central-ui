import { createBrowserRouter, RouterProvider, Outlet } from 'react-router'
import { LoginPage } from '@/pages/LoginPage'
import { Dashboard } from '@/pages/Dashboard'
import { OrderDetail } from '@/pages/OrderDetail'
import { FloorWalk } from '@/pages/FloorWalk'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ChairSandbox } from '@/pages/ChairSandbox'

// Root layout — wraps all routes
function RootLayout() {
  return <Outlet />
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

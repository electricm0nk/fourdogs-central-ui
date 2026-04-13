import { createBrowserRouter, RouterProvider, Outlet } from 'react-router'
import { LoginPage } from '@/pages/LoginPage'
import { Dashboard } from '@/pages/Dashboard'
import { ProtectedRoute } from '@/components/ProtectedRoute'

// Root layout — wraps all routes
function RootLayout() {
  return <Outlet />
}

// Placeholder until order detail is built in Epic 3
function OrderDetail() {
  return <div className="p-4">Order Detail (Epic 3)</div>
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
      { path: 'login', element: <LoginPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App

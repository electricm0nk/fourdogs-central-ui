import { createBrowserRouter, RouterProvider, Outlet } from 'react-router'
import { LoginPage } from '@/pages/LoginPage'

// Root layout — wraps all routes
function RootLayout() {
  return <Outlet />
}

// Placeholder pages — will be replaced in later stories
function Dashboard() {
  return <div className="p-4">Dashboard (Story 2.2)</div>
}

function NotFound() {
  return <div className="p-4">404 — Page not found</div>
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'login', element: <LoginPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App

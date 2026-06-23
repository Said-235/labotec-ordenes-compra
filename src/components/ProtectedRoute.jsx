import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute() {
  const { isAuthenticated, loading, needsDatosFiscales, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-labotec-teal border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (needsDatosFiscales && location.pathname !== '/datos-fiscales') {
    return <Navigate to="/datos-fiscales" replace />
  }

  if (
    !needsDatosFiscales &&
    location.pathname === '/datos-fiscales' &&
    !isAdmin
  ) {
    return <Navigate to="/catalogo" replace />
  }

  return <Outlet />
}

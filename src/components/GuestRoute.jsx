import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/**
 * Solo para rutas públicas (login). Redirige si ya hay sesión válida.
 */
export default function GuestRoute() {
  const { isAuthenticated, loading, isAdmin, needsDatosFiscales } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-labotec-teal border-t-transparent" />
      </div>
    )
  }

  if (isAuthenticated) {
    if (needsDatosFiscales) return <Navigate to="/datos-fiscales" replace />
    if (isAdmin) return <Navigate to="/admin" replace />
    return <Navigate to="/catalogo" replace />
  }

  return <Outlet />
}

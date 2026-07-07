import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { CarritoProvider } from './context/CarritoContext'
import { CategoriasProvider } from './context/CategoriasContext'
import { NotificacionesProvider } from './context/NotificacionesContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import GuestRoute from './components/GuestRoute'
import RootRedirect from './components/RootRedirect'
import AdminLayout from './components/AdminLayout'
import ClientLayout from './components/ClientLayout'

const Login = lazy(() => import('./pages/Login'))
const DatosFiscales = lazy(() => import('./pages/DatosFiscales'))
const CondicionesComerciales = lazy(() => import('./pages/CondicionesComerciales'))
const Catalogo = lazy(() => import('./pages/cliente/Catalogo'))
const Carrito = lazy(() => import('./pages/cliente/Carrito'))
const MisOrdenes = lazy(() => import('./pages/cliente/MisOrdenes'))
const Notificaciones = lazy(() => import('./pages/cliente/Notificaciones'))
const MiCuenta = lazy(() => import('./pages/cliente/MiCuenta'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const CargaODS = lazy(() => import('./pages/admin/CargaODS'))
const OrdenesAdmin = lazy(() => import('./pages/admin/Ordenes'))
const Clientes = lazy(() => import('./pages/admin/Clientes'))
const Administradores = lazy(() => import('./pages/admin/Administradores'))
const Categorias = lazy(() => import('./pages/admin/Categorias'))
const Productos = lazy(() => import('./pages/admin/Productos'))

function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-labotec-teal border-t-transparent" />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <CategoriasProvider>
        <NotificacionesProvider>
          <CarritoProvider>
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<RootRedirect />} />

                  <Route element={<GuestRoute />}>
                    <Route path="/login" element={<Login />} />
                  </Route>

                  <Route element={<ProtectedRoute />}>
                    <Route path="/datos-fiscales" element={<DatosFiscales />} />
                    <Route path="/condiciones-comerciales" element={<CondicionesComerciales />} />
                    <Route element={<ClientLayout />}>
                      <Route path="/catalogo" element={<Catalogo />} />
                      <Route path="/carrito" element={<Carrito />} />
                      <Route path="/notificaciones" element={<Notificaciones />} />
                      <Route path="/mis-ordenes" element={<MisOrdenes />} />
                      <Route path="/mi-cuenta" element={<MiCuenta />} />
                    </Route>
                  </Route>

                  <Route element={<AdminRoute />}>
                    <Route element={<AdminLayout />}>
                      <Route path="/admin" element={<Dashboard />} />
                      <Route path="/admin/clientes" element={<Clientes />} />
                      <Route path="/admin/categorias" element={<Categorias />} />
                      <Route path="/admin/administradores" element={<Administradores />} />
                      <Route path="/admin/productos" element={<Productos />} />
                      <Route path="/admin/carga-ods" element={<CargaODS />} />
                      <Route path="/admin/ordenes" element={<OrdenesAdmin />} />
                    </Route>
                  </Route>

                  <Route path="*" element={<RootRedirect />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </CarritoProvider>
        </NotificacionesProvider>
      </CategoriasProvider>
    </AuthProvider>
  )
}

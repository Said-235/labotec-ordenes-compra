import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { CarritoProvider } from './context/CarritoContext'
import { NotificacionesProvider } from './context/NotificacionesContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import GuestRoute from './components/GuestRoute'
import RootRedirect from './components/RootRedirect'
import AdminLayout from './components/AdminLayout'
import ClientLayout from './components/ClientLayout'
import Login from './pages/Login'
import DatosFiscales from './pages/DatosFiscales'
import Catalogo from './pages/cliente/Catalogo'
import Carrito from './pages/cliente/Carrito'
import MisOrdenes from './pages/cliente/MisOrdenes'
import Notificaciones from './pages/cliente/Notificaciones'
import MiCuenta from './pages/cliente/MiCuenta'
import Dashboard from './pages/admin/Dashboard'
import CargaODS from './pages/admin/CargaODS'
import OrdenesAdmin from './pages/admin/Ordenes'
import Clientes from './pages/admin/Clientes'
import Administradores from './pages/admin/Administradores'
import Productos from './pages/admin/Productos'

export default function App() {
  return (
    <AuthProvider>
      <NotificacionesProvider>
        <CarritoProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />

            <Route element={<GuestRoute />}>
              <Route path="/login" element={<Login />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route path="/datos-fiscales" element={<DatosFiscales />} />
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
                <Route path="/admin/administradores" element={<Administradores />} />
                <Route path="/admin/productos" element={<Productos />} />
                <Route path="/admin/carga-ods" element={<CargaODS />} />
                <Route path="/admin/ordenes" element={<OrdenesAdmin />} />
              </Route>
            </Route>

            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </BrowserRouter>
      </CarritoProvider>
      </NotificacionesProvider>
    </AuthProvider>
  )
}

import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/clientes', label: 'Clientes' },
  { to: '/admin/administradores', label: 'Administradores' },
  { to: '/admin/productos', label: 'Productos' },
  { to: '/admin/carga-ods', label: 'Carga ODS' },
  { to: '/admin/ordenes', label: 'Órdenes' },
]

export default function AdminLayout() {
  const { cliente, signOut } = useAuth()

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col bg-gray-900 text-white">
        <div className="border-b border-gray-700 p-5">
          <img
            src="/logo-labotec.png"
            alt="Labotec"
            className="mx-auto mb-3 h-16 w-16 rounded-full bg-white p-1"
          />
          <p className="text-center text-sm font-semibold">Labotec Supply</p>
          <p className="mt-1 text-center text-xs text-gray-400">Administración</p>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? 'bg-labotec-teal font-medium text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-700 p-4">
          <p className="truncate text-xs text-gray-400">{cliente?.email}</p>
          <button
            type="button"
            onClick={() => signOut()}
            className="mt-2 text-sm text-gray-300 hover:text-white"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/clientes', label: 'Clientes' },
  { to: '/admin/categorias', label: 'Categorías' },
  { to: '/admin/administradores', label: 'Administradores' },
  { to: '/admin/productos', label: 'Productos' },
  { to: '/admin/carga-ods', label: 'Carga ODS' },
  { to: '/admin/ordenes', label: 'Órdenes' },
]

function NavItems({ onNavigate }) {
  return (
    <nav className="flex-1 space-y-1 p-3">
      {navItems.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
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
  )
}

export default function AdminLayout() {
  const { cliente, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Top bar móvil */}
      <header className="flex items-center justify-between bg-gray-900 px-4 py-3 text-white md:hidden">
        <div className="flex items-center gap-3">
          <img
            src="/logo-labotec.png"
            alt="Labotec"
            className="h-10 w-10 rounded-full bg-white p-0.5"
          />
          <div>
            <p className="text-sm font-semibold">Labotec Supply</p>
            <p className="text-xs text-gray-400">Administración</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="rounded-lg border border-gray-600 px-3 py-2 text-sm"
          aria-expanded={menuOpen}
          aria-label="Abrir menú"
        >
          Menú
        </button>
      </header>

      {/* Drawer móvil */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Cerrar menú"
            onClick={closeMenu}
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-gray-900 text-white shadow-xl">
            <div className="border-b border-gray-700 p-5">
              <p className="text-sm font-semibold">Navegación</p>
            </div>
            <NavItems onNavigate={closeMenu} />
            <div className="border-t border-gray-700 p-4">
              <p className="truncate text-xs text-gray-400">{cliente?.email}</p>
              <button
                type="button"
                onClick={() => {
                  closeMenu()
                  signOut()
                }}
                className="mt-2 text-sm text-gray-300 hover:text-white"
              >
                Cerrar sesión
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 flex-col bg-gray-900 text-white md:flex">
        <div className="border-b border-gray-700 p-5">
          <img
            src="/logo-labotec.png"
            alt="Labotec"
            className="mx-auto mb-3 h-16 w-16 rounded-full bg-white p-1"
          />
          <p className="text-center text-sm font-semibold">Labotec Supply</p>
          <p className="mt-1 text-center text-xs text-gray-400">Administración</p>
        </div>

        <NavItems />

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

      <main className="min-w-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

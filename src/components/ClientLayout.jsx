import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCarrito } from '../hooks/useCarrito'
import { useNotificaciones } from '../hooks/useNotificaciones'

const navItems = [
  { to: '/catalogo', label: 'Catálogo', end: true },
  { to: '/carrito', label: 'Carrito' },
  { to: '/notificaciones', label: 'Notificaciones', badge: 'notificaciones' },
  { to: '/mis-ordenes', label: 'Mis órdenes' },
  { to: '/mi-cuenta', label: 'Mi cuenta' },
]

function NavLinks({ onNavigate, className = '' }) {
  const { totalItems } = useCarrito()
  const { noLeidas: notificacionesNoLeidas } = useNotificaciones()

  return (
    <nav className={className}>
      {navItems.map(({ to, label, end, badge }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `relative text-sm font-medium ${
              isActive ? 'text-labotec-teal' : 'text-gray-600 hover:text-gray-900'
            }`
          }
        >
          {label}
          {to === '/carrito' && totalItems > 0 && (
            <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-labotec-teal px-1 text-[10px] font-bold text-white">
              {totalItems > 99 ? '99+' : totalItems}
            </span>
          )}
          {badge === 'notificaciones' && notificacionesNoLeidas > 0 && (
            <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {notificacionesNoLeidas > 99 ? '99+' : notificacionesNoLeidas}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export default function ClientLayout() {
  const { signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/logo-labotec.png" alt="Labotec" className="h-10 w-10 shrink-0" />
            <p className="truncate text-sm font-bold text-gray-900">Labotec Supply</p>
          </div>

          <NavLinks className="hidden items-center gap-5 md:flex" />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => signOut()}
              className="hidden text-sm text-gray-500 hover:text-gray-800 md:inline"
            >
              Salir
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 md:hidden"
              aria-expanded={menuOpen}
              aria-label="Abrir menú"
            >
              Menú
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-gray-100 px-4 py-3 md:hidden">
            <NavLinks
              onNavigate={closeMenu}
              className="flex flex-col gap-3"
            />
            <button
              type="button"
              onClick={() => {
                closeMenu()
                signOut()
              }}
              className="mt-4 text-left text-sm text-gray-500 hover:text-gray-800"
            >
              Salir
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-0">
        <Outlet />
      </main>
    </div>
  )
}

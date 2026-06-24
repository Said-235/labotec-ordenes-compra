import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCarrito } from '../hooks/useCarrito'
import { NIVELES_CLIENTE } from '../lib/constants'

const navItems = [
  { to: '/catalogo', label: 'Catálogo', end: true },
  { to: '/carrito', label: 'Carrito' },
  { to: '/mis-ordenes', label: 'Mis órdenes' },
  { to: '/mi-cuenta', label: 'Mi cuenta' },
]

export default function ClientLayout() {
  const { cliente, signOut } = useAuth()
  const { totalItems } = useCarrito()

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <img src="/logo-labotec.png" alt="Labotec" className="h-10 w-10" />
            <div>
              <p className="text-sm font-bold text-gray-900">Labotec Supply</p>
              {cliente && (
                <p className="text-xs text-gray-500">
                  Nivel {cliente.nivel} — {NIVELES_CLIENTE[cliente.nivel]}
                </p>
              )}
            </div>
          </div>

          <nav className="flex items-center gap-4">
            {navItems.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
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
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => signOut()}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              Salir
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl">
        <Outlet />
      </main>
    </div>
  )
}

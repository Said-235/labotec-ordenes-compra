import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSafeErrorMessage } from '../../lib/errors'
import { callAdmin } from '../../lib/adminApi'

const cards = [
  {
    to: '/admin/clientes',
    title: 'Clientes',
    description: 'Crear cuentas y asignar el aumento de precio de cada cliente',
  },
  {
    to: '/admin/categorias',
    title: 'Categorías',
    description: 'Agregar y administrar categorías de productos',
  },
  {
    to: '/admin/administradores',
    title: 'Administradores',
    description: 'Crear cuentas admin para validar órdenes y gestionar el sistema',
  },
  {
    to: '/admin/productos',
    title: 'Productos',
    description: 'Crear, editar y desactivar productos del catálogo',
  },
  {
    to: '/admin/carga-ods',
    title: 'Carga ODS',
    description: 'Importar productos masivamente desde archivos ODS/XLSX',
  },
  {
    to: '/admin/ordenes',
    title: 'Órdenes',
    description: 'Validar comprobantes y gestionar pagos',
  },
]

async function fetchStats() {
  return callAdmin('dashboard.stats')
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch((err) => setError(getSafeErrorMessage(err, 'No se pudieron cargar las estadísticas')))
  }, [])

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-gray-900">Panel de administración</h1>
      <p className="mt-2 text-gray-500">Gestión de Labotec Supply</p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {stats && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Clientes activos" value={stats.clientes} />
          <Stat label="Productos activos" value={stats.productos} />
          <Stat label="Órdenes pendientes" value={stats.ordenesPendientes} />
          <Stat label="Comprobantes por validar" value={stats.comprobantesPendientes} highlight />
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {cards.map(({ to, title, description }) => (
          <Link
            key={to}
            to={to}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-labotec-teal hover:shadow-md"
          >
            <h2 className="font-semibold text-gray-900">{title}</h2>
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, highlight }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${highlight && value > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  )
}

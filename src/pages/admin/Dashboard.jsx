import { Link } from 'react-router-dom'

export default function Dashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">Panel de administración</h1>
      <p className="mt-2 text-gray-500">Gestión de Labotec Supply</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/admin/clientes"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-labotec-teal hover:shadow-md"
        >
          <h2 className="font-semibold text-gray-900">Clientes</h2>
          <p className="mt-1 text-sm text-gray-500">
            Crear cuentas, asignar nivel y configurar descuentos
          </p>
        </Link>

        <Link
          to="/admin/carga-ods"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-labotec-teal hover:shadow-md"
        >
          <h2 className="font-semibold text-gray-900">Carga ODS</h2>
          <p className="mt-1 text-sm text-gray-500">
            Importar productos masivamente desde archivos ODS/XLSX
          </p>
        </Link>

        <Link
          to="/admin/ordenes"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-labotec-teal hover:shadow-md"
        >
          <h2 className="font-semibold text-gray-900">Órdenes</h2>
          <p className="mt-1 text-sm text-gray-500">
            Validar comprobantes y gestionar pagos
          </p>
        </Link>
      </div>
    </div>
  )
}

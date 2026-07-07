import { Link, useNavigate } from 'react-router-dom'
import { CONDICIONES_COMERCIALES } from '../lib/condicionesComerciales'

export default function CondicionesComerciales() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <div className="mb-6 flex items-center gap-4 border-b border-gray-100 pb-6">
            <img
              src="/logo-labotec.png"
              alt="Labotec"
              className="h-14 w-14 object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {CONDICIONES_COMERCIALES.titulo}
              </h1>
              <p className="text-sm text-gray-500">Ingeniería Labotec</p>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-gray-700">
            {CONDICIONES_COMERCIALES.introduccion}
          </p>

          <ol className="mt-8 space-y-6">
            {CONDICIONES_COMERCIALES.puntos.map((punto, index) => (
              <li key={punto.titulo} className="text-sm text-gray-700">
                <h2 className="font-semibold text-gray-900">
                  {index + 1}. {punto.titulo}
                </h2>
                <p className="mt-2 leading-relaxed">{punto.texto}</p>
              </li>
            ))}
          </ol>

          <p className="mt-8 rounded-lg bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800">
            {CONDICIONES_COMERCIALES.aceptacion}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Volver
            </button>
            <Link
              to="/datos-fiscales"
              className="rounded-lg bg-labotec-teal px-4 py-2 text-sm font-semibold text-white hover:bg-labotec-teal-dark"
            >
              Ir al registro
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

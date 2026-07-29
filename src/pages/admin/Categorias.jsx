import { useCallback, useEffect, useState } from 'react'
import {
  actualizarEstadoCategoria,
  crearCategoria,
  listarCategorias,
} from '../../lib/admin/categorias'
import { slugifyCategoria } from '../../lib/categorias'
import { getSafeErrorMessage } from '../../lib/errors'
import { useCategorias } from '../../hooks/useCategorias'

export default function CategoriasAdmin() {
  const { refreshCategorias } = useCategorias()
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listarCategorias()
      setCategorias(data)
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudieron cargar las categorías'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  function flash(msg) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 4000)
  }

  async function handleCrear(event) {
    event.preventDefault()
    setGuardando(true)
    setError('')
    try {
      await crearCategoria({ nombre })
      setNombre('')
      flash('Categoría creada')
      await cargar()
      await refreshCategorias()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo crear la categoría'))
    } finally {
      setGuardando(false)
    }
  }

  async function handleToggle(clave, activoActual) {
    setError('')
    try {
      await actualizarEstadoCategoria(clave, !activoActual)
      flash(activoActual ? 'Categoría desactivada' : 'Categoría reactivada')
      await cargar()
      await refreshCategorias()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo actualizar la categoría'))
    }
  }

  const clavePreview = nombre.trim() ? slugifyCategoria(nombre) : ''

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
      <p className="mt-1 text-sm text-gray-500">
        Administre las categorías de productos y órdenes de compra
      </p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div>
      )}

      <form
        onSubmit={handleCrear}
        className="mt-6 max-w-xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <h2 className="font-semibold text-gray-900">Nueva categoría</h2>
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="nombre-categoria" className="mb-1 block text-sm font-medium text-gray-700">
              Nombre
            </label>
            <input
              id="nombre-categoria"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Hematología"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-labotec-teal focus:outline-none"
              required
            />
          </div>
          {clavePreview && (
            <p className="text-xs text-gray-500">
              Clave interna: <span className="font-mono">{clavePreview}</span>
            </p>
          )}
          <button
            type="submit"
            disabled={guardando}
            className="rounded-lg bg-labotec-teal px-4 py-2 text-sm font-semibold text-white hover:bg-labotec-teal-dark disabled:opacity-60"
          >
            {guardando ? 'Creando…' : 'Crear categoría'}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="mt-12 flex justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-labotec-teal border-t-transparent" />
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Clave</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categorias.map((cat) => (
                <tr key={cat.clave} className={!cat.activo ? 'bg-gray-50 opacity-70' : ''}>
                  <td className="px-4 py-3 font-medium">{cat.nombre}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{cat.clave}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        cat.activo
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {cat.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggle(cat.clave, cat.activo)}
                      className={`text-xs hover:underline ${
                        cat.activo ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {cat.activo ? 'Desactivar' : 'Reactivar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

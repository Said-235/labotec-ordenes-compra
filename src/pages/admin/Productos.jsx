import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  actualizarProducto,
  crearProducto,
  desactivarProducto,
  listarProductos,
  reactivarProducto,
} from '../../lib/admin/productos'
import { CATEGORIAS, CATEGORIA_KEYS, CLASES_PRODUCTO } from '../../lib/constants'
import { getSafeErrorMessage } from '../../lib/errors'
import { formatMXN } from '../../lib/pricing'
import { sanitizeText } from '../../lib/validation'

const FORM_VACIO = {
  codigo: '',
  descripcion: '',
  clase: 'Reactivo',
  categoria: CATEGORIA_KEYS[0],
  precio_base: '',
  grupo_prueba: '',
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function Productos() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroClase, setFiltroClase] = useState('')
  const [filtroActivo, setFiltroActivo] = useState('todos')
  const [busqueda, setBusqueda] = useState('')

  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listarProductos({
        categoria: filtroCategoria || undefined,
        soloActivos: filtroActivo === 'activos',
      })
      setProductos(data)
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Error al cargar productos'))
    } finally {
      setLoading(false)
    }
  }, [filtroCategoria, filtroActivo])

  useEffect(() => {
    cargar()
  }, [cargar])

  const productosFiltrados = useMemo(() => {
    const term = sanitizeText(busqueda, 100).toLowerCase()
    return productos.filter((p) => {
      if (filtroClase && p.clase !== filtroClase) return false
      if (filtroActivo === 'inactivos' && p.activo) return false
      if (!term) return true
      return (
        p.codigo.toLowerCase().includes(term) ||
        p.descripcion.toLowerCase().includes(term)
      )
    })
  }, [productos, busqueda, filtroClase, filtroActivo])

  function flash(msg) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 4000)
  }

  function abrirCrear() {
    setEditando(null)
    setForm(FORM_VACIO)
    setModalAbierto(true)
  }

  function abrirEditar(producto) {
    setEditando(producto)
    setForm({
      codigo: producto.codigo,
      descripcion: producto.descripcion,
      clase: producto.clase,
      categoria: producto.categoria,
      precio_base: String(producto.precio_base),
      grupo_prueba: producto.grupo_prueba ?? '',
    })
    setModalAbierto(true)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setGuardando(true)
    setError('')

    try {
      const payload = {
        ...form,
        precio_base: Number(form.precio_base),
        grupo_prueba: form.grupo_prueba.trim() || null,
      }

      if (editando) {
        await actualizarProducto(editando.id, payload)
        flash('Producto actualizado')
      } else {
        await crearProducto(payload)
        flash('Producto creado')
      }

      setModalAbierto(false)
      await cargar()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo guardar el producto'))
    } finally {
      setGuardando(false)
    }
  }

  async function handleToggleActivo(producto) {
    setError('')
    try {
      if (producto.activo) {
        await desactivarProducto(producto.id)
        flash('Producto desactivado')
      } else {
        await reactivarProducto(producto.id)
        flash('Producto reactivado')
      }
      await cargar()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo cambiar el estado'))
    }
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Catálogo manual — crear, editar y desactivar productos
          </p>
        </div>
        <button
          type="button"
          onClick={abrirCrear}
          className="rounded-lg bg-labotec-teal px-4 py-2 text-sm font-semibold text-white hover:bg-labotec-teal-dark"
        >
          + Nuevo producto
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <input
          type="search"
          placeholder="Buscar código o descripción…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm min-w-[200px]"
        />
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todas las categorías</option>
          {CATEGORIA_KEYS.map((k) => (
            <option key={k} value={k}>{CATEGORIAS[k]}</option>
          ))}
        </select>
        <select
          value={filtroClase}
          onChange={(e) => setFiltroClase(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todas las clases</option>
          {CLASES_PRODUCTO.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filtroActivo}
          onChange={(e) => setFiltroActivo(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="todos">Activos e inactivos</option>
          <option value="activos">Solo activos</option>
          <option value="inactivos">Solo inactivos</option>
        </select>
      </div>

      {loading ? (
        <div className="mt-12 flex justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-labotec-teal border-t-transparent" />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3">Clase</th>
                <th className="px-4 py-3">Grupo prueba</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3 text-right">Precio base</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {productosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No hay productos
                  </td>
                </tr>
              ) : (
                productosFiltrados.map((p) => (
                  <tr
                    key={p.id}
                    className={!p.activo ? 'bg-gray-50 opacity-70' : 'hover:bg-gray-50'}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{p.codigo}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{p.descripcion}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{p.clase}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {p.grupo_prueba || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">{CATEGORIAS[p.categoria]}</td>
                    <td className="px-4 py-3 text-right">{formatMXN(p.precio_base)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.activo ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => abrirEditar(p)}
                          className="text-xs text-labotec-teal hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActivo(p)}
                          className={`text-xs hover:underline ${
                            p.activo ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {p.activo ? 'Desactivar' : 'Reactivar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-gray-400">
            {productosFiltrados.length} producto(s) mostrados
          </p>
        </div>
      )}

      <Modal
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        title={editando ? 'Editar producto' : 'Nuevo producto'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Código</label>
            <input
              value={form.codigo}
              onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
              required
              disabled={Boolean(editando)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
            />
            {editando && (
              <p className="mt-1 text-xs text-gray-400">El código no se puede modificar</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Descripción</label>
            <input
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Clase</label>
              <select
                value={form.clase}
                onChange={(e) => setForm((f) => ({ ...f, clase: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {CLASES_PRODUCTO.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Categoría</label>
              <select
                value={form.categoria}
                onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                disabled={Boolean(editando)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
              >
                {CATEGORIA_KEYS.map((k) => (
                  <option key={k} value={k}>{CATEGORIAS[k]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Grupo de prueba
            </label>
            <input
              value={form.grupo_prueba}
              onChange={(e) => setForm((f) => ({ ...f, grupo_prueba: e.target.value }))}
              placeholder="Ej: TSH, GLUCOSA, HEMOGLOBINA"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-gray-400">
              Reactivo, Calibrador y Control de la misma prueba deben compartir el mismo grupo.
              Obligatorio para Calibrador y Control.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Precio base (MXN)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.precio_base}
              onChange={(e) => setForm((f) => ({ ...f, precio_base: e.target.value }))}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={guardando}
            className="w-full rounded-lg bg-labotec-teal py-2.5 text-sm font-semibold text-white hover:bg-labotec-teal-dark disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </form>
      </Modal>
    </div>
  )
}

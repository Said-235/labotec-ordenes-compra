import { useEffect, useMemo, useState } from 'react'
import ConfirmacionModal from '../../components/ConfirmacionModal'
import AlertaModal from '../../components/AlertaModal'
import AvisoCorteBanner from '../../components/AvisoCorteBanner'
import { useAuth } from '../../hooks/useAuth'
import { useCarrito } from '../../hooks/useCarrito'
import { useCategorias } from '../../hooks/useCategorias'
import { supabase } from '../../lib/supabaseClient'
import { MULTIPLICADOR_PRECIO_SIN_REACTIVO } from '../../lib/constants'
import { mensajeConfirmacionPrecioDoble } from '../../lib/cartValidation'
import { getSafeErrorMessage } from '../../lib/errors'
import { calcularPrecioUnitario, formatMXN, resolverAumento } from '../../lib/pricing'
import { sanitizeText } from '../../lib/validation'

export default function Catalogo() {
  const { cliente } = useAuth()
  const { categoriaKeys, categoriaMap } = useCategorias()
  const { agregarProducto, totalItems } = useCarrito()
  const [productos, setProductos] = useState([])
  const [categoria, setCategoria] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [claseFiltro, setClaseFiltro] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)
  const [alertaCarrito, setAlertaCarrito] = useState(null)
  const [confirmacionCarrito, setConfirmacionCarrito] = useState(null)

  const aumentos = cliente?.aumentos_por_clase ?? cliente

  useEffect(() => {
    if (categoriaKeys.length && !categoriaKeys.includes(categoria)) {
      setCategoria(categoriaKeys[0])
    }
  }, [categoriaKeys, categoria])

  useEffect(() => {
    async function cargarDatos() {
      if (!cliente || !categoria) return

      setLoading(true)
      setError('')

      try {
        const { data, error: productosError } = await supabase
          .from('productos')
          .select('id, codigo, descripcion, clase, categoria, precio_base, grupo_prueba')
          .eq('categoria', categoria)
          .eq('activo', true)
          .order('codigo')

        if (productosError) throw productosError

        setProductos(data ?? [])
      } catch (err) {
        setError(getSafeErrorMessage(err, 'No se pudo cargar el catálogo'))
        setProductos([])
      } finally {
        setLoading(false)
      }
    }

    cargarDatos()
  }, [cliente, categoria])

  const productosFiltrados = useMemo(() => {
    const term = sanitizeText(busqueda, 100).toLowerCase()

    return productos.filter((p) => {
      if (claseFiltro && p.clase !== claseFiltro) return false
      if (!term) return true
      return (
        p.codigo.toLowerCase().includes(term) ||
        p.descripcion.toLowerCase().includes(term)
      )
    })
  }, [productos, busqueda, claseFiltro])

  const clasesDisponibles = useMemo(
    () => [...new Set(productos.map((p) => p.clase))].sort(),
    [productos],
  )

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  function handleAgregar(producto) {
    const result = agregarProducto(producto, 1)
    if (result.ok) {
      showToast(`${producto.codigo} agregado al carrito`)
      return
    }

    if (result.requiresConfirmacion) {
      const precioNormal = calcularPrecioUnitario(
        producto.precio_base,
        resolverAumento(aumentos, producto.clase),
      )
      const precioDoble =
        Math.round(precioNormal * MULTIPLICADOR_PRECIO_SIN_REACTIVO * 100) / 100
      setConfirmacionCarrito({
        producto,
        mensaje: mensajeConfirmacionPrecioDoble(
          producto,
          formatMXN(precioNormal),
          formatMXN(precioDoble),
        ),
      })
      return
    }

    setAlertaCarrito(result.message)
  }

  function handleConfirmarAgregar() {
    if (!confirmacionCarrito) return

    const { producto } = confirmacionCarrito
    const result = agregarProducto(producto, 1, { confirmarPrecioDoble: true })

    if (result.ok) {
      showToast(`${producto.codigo} agregado al carrito`)
      setConfirmacionCarrito(null)
      return
    }

    setConfirmacionCarrito(null)
    setAlertaCarrito(result.message ?? 'No se pudo agregar el producto al carrito')
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo</h1>
          <p className="mt-1 text-sm text-gray-500">Productos disponibles para su cuenta</p>
        </div>
      </div>

      <div className="mt-4">
        <AvisoCorteBanner />
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg ${
            toast.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-gray-900 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      <AlertaModal
        titulo="No se puede agregar al carrito"
        mensaje={alertaCarrito}
        onCerrar={() => setAlertaCarrito(null)}
      />

      <ConfirmacionModal
        titulo="Precio sin Reactivo"
        mensaje={confirmacionCarrito?.mensaje}
        onConfirmar={handleConfirmarAgregar}
        onCancelar={() => setConfirmacionCarrito(null)}
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="max-w-full overflow-x-auto">
          <div className="flex w-max min-w-full rounded-lg border border-gray-200 bg-white p-1">
            {categoriaKeys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategoria(key)}
                className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition ${
                  categoria === key
                    ? 'bg-labotec-teal text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {categoriaMap[key]}
              </button>
            ))}
          </div>
        </div>

        <input
          type="search"
          placeholder="Buscar por código o descripción…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-labotec-teal focus:outline-none focus:ring-2 focus:ring-labotec-teal/30"
        />

        <select
          value={claseFiltro}
          onChange={(e) => setClaseFiltro(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-labotec-teal focus:outline-none"
        >
          <option value="">Todas las clases</option>
          {clasesDisponibles.map((clase) => (
            <option key={clase} value={clase}>
              {clase}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-12 flex justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-labotec-teal border-t-transparent" />
        </div>
      ) : productosFiltrados.length === 0 ? (
        <p className="mt-12 text-center text-gray-500">No hay productos en esta categoría</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3">Clase</th>
                <th className="px-4 py-3 text-right">Precio</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {productosFiltrados.map((producto) => {
                const precioFinal = calcularPrecioUnitario(
                  producto.precio_base,
                  resolverAumento(aumentos, producto.clase),
                )

                return (
                  <tr key={producto.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{producto.codigo}</td>
                    <td className="px-4 py-3">{producto.descripcion}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                        {producto.clase}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-labotec-teal-dark">
                      {formatMXN(precioFinal)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleAgregar(producto)}
                        className="rounded-lg bg-labotec-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-labotec-teal-dark"
                      >
                        Agregar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400">
        {productosFiltrados.length} producto(s) mostrados
        {totalItems > 0 && ` — ${totalItems} en carrito`}
      </p>
    </div>
  )
}

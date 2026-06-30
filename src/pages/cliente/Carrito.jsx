import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCarrito } from '../../hooks/useCarrito'
import { CATEGORIAS } from '../../lib/constants'
import { getSafeErrorMessage } from '../../lib/errors'
import { mensajeViolacionesReactivo } from '../../lib/cartValidation'
import { confirmarOrden } from '../../lib/orders/confirmarOrden'
import { formatMXN } from '../../lib/pricing'

export default function Carrito() {
  const {
    items,
    esValido,
    violacionesReactivo,
    actualizarCantidad,
    eliminarProducto,
    vaciarCarrito,
  } = useCarrito()

  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState('')
  const [ordenesCreadas, setOrdenesCreadas] = useState(null)
  const [mensajeItem, setMensajeItem] = useState('')

  const porCategoria = items.reduce((acc, item) => {
    if (!acc[item.categoria]) acc[item.categoria] = []
    acc[item.categoria].push(item)
    return acc
  }, {})

  async function handleConfirmar() {
    setError('')
    setMensajeItem('')

    if (!esValido) {
      setError(
        violacionesReactivo.length
          ? mensajeViolacionesReactivo(violacionesReactivo)
          : 'El carrito está vacío',
      )
      return
    }

    setConfirmando(true)

    try {
      const ordenes = await confirmarOrden(items)
      setOrdenesCreadas(ordenes)
      vaciarCarrito()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo confirmar la orden'))
    } finally {
      setConfirmando(false)
    }
  }

  function handleCantidadChange(productoId, value) {
    setMensajeItem('')
    const result = actualizarCantidad(productoId, value)
    if (!result.ok) setMensajeItem(result.message)
  }

  function handleEliminar(productoId) {
    setMensajeItem('')
    const result = eliminarProducto(productoId)
    if (!result.ok) setMensajeItem(result.message)
  }

  if (ordenesCreadas) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-lg rounded-xl border border-green-200 bg-green-50 p-6">
          <h1 className="text-xl font-bold text-green-900">Orden confirmada</h1>
          <p className="mt-2 text-sm text-green-800">
            Se generaron {ordenesCreadas.length} orden(es), una por categoría.
          </p>
          <p className="mt-3 text-sm text-green-900">
            Para completar el pago, diríjase a{' '}
            <span className="font-medium">Mis órdenes</span> y cargue su comprobante de pago
            (PDF, JPG o PNG). Recibirá un aviso en{' '}
            <span className="font-medium">Notificaciones</span> cuando administración lo revise.
          </p>

          <ul className="mt-4 space-y-3">
            {ordenesCreadas.map((orden) => (
              <li
                key={orden.id}
                className="rounded-lg bg-white p-4 text-sm shadow-sm"
              >
                <p className="font-medium">
                  {CATEGORIAS[orden.categoria]} — {formatMXN(orden.total)}
                </p>
                <p className="mt-1 text-xs text-gray-500 font-mono">{orden.id}</p>
                {orden.pdf_url && (
                  <a
                    href={orden.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-labotec-teal hover:underline"
                  >
                    Descargar PDF
                  </a>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex gap-3">
            <Link
              to="/catalogo"
              className="rounded-lg bg-labotec-teal px-4 py-2 text-sm font-medium text-white hover:bg-labotec-teal-dark"
            >
              Seguir comprando
            </Link>
            <Link
              to="/mis-ordenes"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Ver mis órdenes
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">Carrito</h1>
      <p className="mt-1 text-sm text-gray-500">
        {items.length === 0
          ? 'Su carrito está vacío'
          : `${items.length} producto(s) — se generará una orden por categoría`}
      </p>

      {items.length === 0 ? (
        <div className="mt-8 text-center">
          <Link
            to="/catalogo"
            className="text-labotec-teal hover:underline"
          >
            Ir al catálogo
          </Link>
        </div>
      ) : (
        <>
          {Object.entries(porCategoria).map(([cat, lineas]) => (
            <section key={cat} className="mt-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                {CATEGORIAS[cat]}
              </h2>
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Código</th>
                      <th className="px-4 py-3">Descripción</th>
                      <th className="px-4 py-3">Clase</th>
                      <th className="px-4 py-3">Grupo</th>
                      <th className="px-4 py-3">Cantidad</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lineas.map((item) => (
                      <tr key={item.producto_id}>
                        <td className="px-4 py-3 font-mono text-xs">{item.codigo}</td>
                        <td className="px-4 py-3">{item.descripcion}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                            {item.clase}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {item.grupo_prueba || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={1}
                            max={99}
                            value={item.cantidad}
                            onChange={(e) =>
                              handleCantidadChange(item.producto_id, e.target.value)
                            }
                            className="w-16 rounded border border-gray-300 px-2 py-1 text-center text-sm"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleEliminar(item.producto_id)}
                            className="text-red-600 hover:text-red-800 text-xs"
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          {violacionesReactivo.length > 0 && (
            <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 whitespace-pre-line">
              {mensajeViolacionesReactivo(violacionesReactivo)}
            </div>
          )}

          {mensajeItem && (
            <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {mensajeItem}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-line">
              {error}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                vaciarCarrito()
                setMensajeItem('')
              }}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              Vaciar carrito
            </button>

            <button
              type="button"
              onClick={handleConfirmar}
              disabled={!esValido || confirmando}
              className="rounded-lg bg-labotec-teal px-6 py-2.5 text-sm font-semibold text-white hover:bg-labotec-teal-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {confirmando ? 'Confirmando…' : 'Confirmar orden'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

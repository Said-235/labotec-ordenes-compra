import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AvisoCorteBanner from '../../components/AvisoCorteBanner'
import ConfirmacionModal from '../../components/ConfirmacionModal'
import AlertaModal from '../../components/AlertaModal'
import OrdenTotalesResumen from '../../components/OrdenTotalesResumen'
import { useAuth } from '../../hooks/useAuth'
import { useCarrito } from '../../hooks/useCarrito'
import { useCategorias } from '../../hooks/useCategorias'
import { getSafeErrorMessage } from '../../lib/errors'
import {
  clienteAplicaReglaCalibradorControl,
  mensajeConfirmacionPrecioDoble,
  mensajeViolacionesReactivo,
} from '../../lib/cartValidation'
import { MULTIPLICADOR_PRECIO_SIN_REACTIVO } from '../../lib/constants'
import {
  esVentanaMantenimientoCorte,
  getMensajeAvisoCorte,
  getResumenAvisoCorte,
} from '../../lib/cortePedidos'
import { clientePuedeVerCategoria } from '../../lib/categorias'
import { confirmarOrden } from '../../lib/orders/confirmarOrden'
import {
  calcularTotalesOrden,
  expandirLineasConCoberturaReactivo,
  formatMXN,
} from '../../lib/pricing'
import { supabase } from '../../lib/supabaseClient'

export default function Carrito() {
  const {
    items,
    esValido,
    violacionesReactivo,
    actualizarCantidad,
    eliminarProducto,
    vaciarCarrito,
  } = useCarrito()
  const { getNombreCategoria } = useCategorias()
  const { cliente } = useAuth()

  const [confirmando, setConfirmando] = useState(false)
  const [totalesCarrito, setTotalesCarrito] = useState(null)
  const [error, setError] = useState('')
  const [ordenesCreadas, setOrdenesCreadas] = useState(null)
  const [mensajeItem, setMensajeItem] = useState('')
  const [alertaCantidad, setAlertaCantidad] = useState(null)
  const [confirmacionCantidad, setConfirmacionCantidad] = useState(null)
  const [avisoCortePendiente, setAvisoCortePendiente] = useState(false)
  const avisoCorteActivo = esVentanaMantenimientoCorte()
  const mensajeCorte = getMensajeAvisoCorte()

  const hayNoDisponibles = items.some(
    (item) => !clientePuedeVerCategoria(cliente, item.categoria),
  )

  const porCategoria = items.reduce((acc, item) => {
    if (!acc[item.categoria]) acc[item.categoria] = []
    acc[item.categoria].push(item)
    return acc
  }, {})

  useEffect(() => {
    if (!items.length) {
      setTotalesCarrito(null)
      return
    }

    let cancelled = false

    async function cargarTotales() {
      const productoIds = [...new Set(items.map((i) => i.producto_id))]
      const { data: productos, error } = await supabase
        .from('productos')
        .select('id, clase, categoria, precio_base, grupo_prueba')
        .in('id', productoIds)

      if (cancelled || error || !productos?.length) return

      const productoMap = Object.fromEntries(productos.map((p) => [p.id, p]))
      const lineasInput = items
        .map((item) => {
          const producto = productoMap[item.producto_id]
          if (!producto) return null
          if (!clientePuedeVerCategoria(cliente, producto.categoria)) return null
          return { producto, cantidad: item.cantidad }
        })
        .filter(Boolean)

      if (!lineasInput.length) {
        setTotalesCarrito(null)
        return
      }

      const lineas = expandirLineasConCoberturaReactivo(
        lineasInput,
        cliente,
        { aplicaReglaCalibradorControl: clienteAplicaReglaCalibradorControl(cliente) },
      )
      const subtotal = lineas.reduce((sum, l) => sum + l.subtotal, 0)
      setTotalesCarrito(calcularTotalesOrden(subtotal, { incluirEnvio: true }))
    }

    cargarTotales()
    return () => {
      cancelled = true
    }
  }, [items, cliente])

  function handleConfirmarClick() {
    setError('')
    setMensajeItem('')

    if (hayNoDisponibles) {
      setError('Quite los productos de categorías que ya no tiene asignadas antes de confirmar.')
      return
    }

    if (!esValido) {
      setError(
        violacionesReactivo.length
          ? mensajeViolacionesReactivo(violacionesReactivo)
          : 'El carrito está vacío',
      )
      return
    }

    if (avisoCorteActivo) {
      setAvisoCortePendiente(true)
      return
    }

    confirmarPedido()
  }

  async function confirmarPedido() {
    setAvisoCortePendiente(false)
    setConfirmando(true)
    setError('')

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
    if (result.ok) return

    if (result.requiresConfirmacion) {
      const item = items.find((i) => i.producto_id === productoId)
      if (!item) {
        setAlertaCantidad(result.message ?? 'No se pudo actualizar la cantidad')
        return
      }

      setConfirmacionCantidad({
        productoId,
        cantidad: value,
        mensaje: mensajeConfirmacionPrecioDoble(
          item,
          'tarifa habitual',
          `×${MULTIPLICADOR_PRECIO_SIN_REACTIVO} de la tarifa habitual`,
          {
            qtyReactivo: result.qtyReactivo ?? 0,
            totalClaseTrasAgregar: result.totalClaseTrasAgregar,
          },
        ),
      })
      return
    }

    if (result.message) setMensajeItem(result.message)
    else setAlertaCantidad(result.message ?? 'No se pudo actualizar la cantidad')
  }

  function handleConfirmarCantidad() {
    if (!confirmacionCantidad) return

    const { productoId, cantidad } = confirmacionCantidad
    const result = actualizarCantidad(productoId, cantidad, {
      confirmarPrecioDoble: true,
    })

    setConfirmacionCantidad(null)

    if (!result.ok) {
      setAlertaCantidad(result.message ?? 'No se pudo actualizar la cantidad')
    }
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
          {getResumenAvisoCorte() && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {getResumenAvisoCorte()}
            </p>
          )}
          <p className="mt-3 text-sm text-green-900">
            Su pedido quedó pendiente de pago. Administración confirmará cuando el pago
            llegue y recibirá un aviso en{' '}
            <span className="font-medium">Notificaciones</span>.
          </p>

          <ul className="mt-4 space-y-3">
            {ordenesCreadas.map((orden) => (
              <li
                key={orden.id}
                className="rounded-lg bg-white p-4 text-sm shadow-sm"
              >
                <p className="font-medium">
                  {getNombreCategoria(orden.categoria)} — {formatMXN(orden.total)}
                </p>
                <p className="mt-1 text-xs text-gray-500 font-mono">{orden.id}</p>
                {(orden.pdf_signed_url || orden.pdf_url) && (
                  <a
                    href={orden.pdf_signed_url || orden.pdf_url}
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
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-gray-900">Carrito</h1>
      <p className="mt-1 text-sm text-gray-500">
        {items.length === 0
          ? 'Su carrito está vacío'
          : `${items.length} producto(s) — se generará una orden por categoría`}
      </p>

      <div className="mt-4">
        <AvisoCorteBanner />
      </div>

      <ConfirmacionModal
        titulo="Procesamiento en el siguiente corte"
        mensaje={avisoCortePendiente ? mensajeCorte : null}
        onConfirmar={confirmarPedido}
        onCancelar={() => setAvisoCortePendiente(false)}
        confirmarTexto="Entendido, confirmar"
        cancelarTexto="Volver"
        confirmando={confirmando}
      />

      <ConfirmacionModal
        titulo="Precio sin Reactivo suficiente"
        mensaje={confirmacionCantidad?.mensaje}
        onConfirmar={handleConfirmarCantidad}
        onCancelar={() => setConfirmacionCantidad(null)}
        confirmarTexto="Confirmar"
      />

      <AlertaModal
        titulo="No se puede actualizar"
        mensaje={alertaCantidad}
        onCerrar={() => setAlertaCantidad(null)}
      />

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
                {getNombreCategoria(cat)}
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
                    {lineas.map((item) => {
                      const noDisponible = !clientePuedeVerCategoria(cliente, item.categoria)
                      return (
                      <tr key={item.producto_id} className={noDisponible ? 'bg-amber-50' : undefined}>
                        <td className="px-4 py-3 font-mono text-xs">{item.codigo}</td>
                        <td className="px-4 py-3">
                          {item.descripcion}
                          {noDisponible && (
                            <p className="mt-1 text-xs text-amber-800">
                              No disponible para su cuenta
                            </p>
                          )}
                        </td>
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
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          {hayNoDisponibles && (
            <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Quite los productos de categorías que ya no tiene asignadas antes de confirmar.
            </div>
          )}

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

          {totalesCarrito && (
            <div className="mt-6 rounded-xl border border-gray-200 bg-white px-4 pb-4 shadow-sm">
              <OrdenTotalesResumen
                orden={{
                  subtotal: totalesCarrito.subtotal,
                  total: totalesCarrito.total,
                }}
              />
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => {
                vaciarCarrito()
                setMensajeItem('')
              }}
              className="text-center text-sm text-gray-500 hover:text-gray-800 sm:text-left"
            >
              Vaciar carrito
            </button>

            <button
              type="button"
              onClick={handleConfirmarClick}
              disabled={!esValido || confirmando || hayNoDisponibles}
              className="w-full rounded-lg bg-labotec-teal px-6 py-2.5 text-sm font-semibold text-white hover:bg-labotec-teal-dark disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {confirmando ? 'Confirmando…' : 'Confirmar orden'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

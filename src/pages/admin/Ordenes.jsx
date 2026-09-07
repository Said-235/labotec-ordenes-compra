import { useCallback, useEffect, useState } from 'react'
import StatusBadge from '../../components/StatusBadge'
import {
  getOrdenPdfAdminUrl,
  marcarOrdenPagada,
  obtenerTodasOrdenes,
} from '../../lib/admin/ordenes'
import { useCategorias } from '../../hooks/useCategorias'
import { esEnvioIgualFiscal, getDireccionEnvio } from '../../lib/datosCliente'
import { getSafeErrorMessage } from '../../lib/errors'
import { formatMXN } from '../../lib/pricing'

function formatFecha(iso) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export default function OrdenesAdmin() {
  const { getNombreCategoria } = useCategorias()
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('pendiente')
  const [expandedId, setExpandedId] = useState(null)
  const [notas, setNotas] = useState({})
  const [marcando, setMarcando] = useState(null)

  const cargarOrdenes = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await obtenerTodasOrdenes({
        status: filtroStatus || undefined,
      })
      setOrdenes(data)
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudieron cargar las órdenes'))
    } finally {
      setLoading(false)
    }
  }, [filtroStatus])

  useEffect(() => {
    cargarOrdenes()
  }, [cargarOrdenes])

  async function handleMarcarPagada(ordenId) {
    setMarcando(ordenId)
    setError('')
    try {
      await marcarOrdenPagada(ordenId, notas[ordenId] ?? '')
      setNotas((prev) => {
        const next = { ...prev }
        delete next[ordenId]
        return next
      })
      await cargarOrdenes()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo marcar la orden como pagada'))
    } finally {
      setMarcando(null)
    }
  }

  async function handleVerPdf(orden) {
    try {
      const url = await getOrdenPdfAdminUrl(
        orden.clientes.id,
        orden.id,
        orden.categoria,
      )
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setError('No se pudo abrir el PDF')
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">Órdenes</h1>
      <p className="mt-1 text-sm text-gray-500">
        Confirmar pagos y seguimiento de órdenes
      </p>

      <div className="mt-4">
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="pagada">Pagada</option>
          <option value="vencida">Vencida</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="mt-12 flex justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-labotec-teal border-t-transparent" />
        </div>
      ) : ordenes.length === 0 ? (
        <p className="mt-12 text-center text-gray-500">No hay órdenes</p>
      ) : (
        <div className="mt-6 space-y-4">
          {ordenes.map((orden) => {
            const expanded = expandedId === orden.id

            return (
              <article
                key={orden.id}
                className="rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : orden.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {orden.clientes?.nombre} — {getNombreCategoria(orden.categoria)}
                    </p>
                    <p className="text-sm text-gray-600">{orden.clientes?.email}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {formatFecha(orden.creado_en)} — {formatMXN(orden.total)}
                    </p>
                  </div>
                  <StatusBadge status={orden.status} />
                </button>

                {expanded && (
                  <div className="border-t border-gray-100 px-4 pb-4">
                    <p className="mt-3 font-mono text-xs text-gray-400">{orden.id}</p>

                    <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm">
                      <p className="font-medium text-gray-800">Datos de contacto y envío</p>
                      <dl className="mt-2 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
                        <div>
                          <dt className="font-medium text-gray-500">Contacto</dt>
                          <dd>{orden.clientes?.nombre ?? '—'}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-gray-500">Correo</dt>
                          <dd>{orden.clientes?.email ?? '—'}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-gray-500">Teléfono</dt>
                          <dd>{orden.clientes?.datos_fiscales?.telefono ?? '—'}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-gray-500">Correo facturación</dt>
                          <dd>{orden.clientes?.datos_fiscales?.correo_facturacion ?? '—'}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="font-medium text-gray-500">Razón social</dt>
                          <dd>{orden.clientes?.datos_fiscales?.razon_social ?? '—'}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-gray-500">RFC</dt>
                          <dd>{orden.clientes?.datos_fiscales?.rfc ?? '—'}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="font-medium text-gray-500">Dirección fiscal</dt>
                          <dd>{orden.clientes?.datos_fiscales?.direccion_fiscal ?? '—'}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="font-medium text-gray-500">Dirección de envío</dt>
                          <dd>
                            {getDireccionEnvio(orden.clientes?.datos_fiscales) || '—'}
                          </dd>
                          {esEnvioIgualFiscal(orden.clientes?.datos_fiscales) && (
                            <p className="mt-0.5 text-xs text-gray-400">
                              Igual a la dirección fiscal
                            </p>
                          )}
                        </div>
                      </dl>
                    </div>

                    {orden.payment_confirmed_at && (
                      <p className="mt-2 text-xs text-green-700">
                        Pago confirmado: {formatFecha(orden.payment_confirmed_at)}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => handleVerPdf(orden)}
                      className="mt-3 text-sm text-labotec-teal hover:underline"
                    >
                      Ver PDF de orden
                    </button>

                    {orden.status === 'pendiente' && (
                      <div className="mt-4 rounded-lg bg-gray-50 p-4">
                        <label className="block text-xs font-medium text-gray-600">
                          Notas al aprobar (opcional)
                        </label>
                        <input
                          type="text"
                          value={notas[orden.id] ?? ''}
                          onChange={(e) =>
                            setNotas((prev) => ({
                              ...prev,
                              [orden.id]: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                          placeholder="Referencia interna…"
                        />
                        <button
                          type="button"
                          disabled={marcando === orden.id}
                          onClick={() => handleMarcarPagada(orden.id)}
                          className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                        >
                          {marcando === orden.id ? 'Confirmando…' : 'Marcar como pagada'}
                        </button>
                      </div>
                    )}

                    {orden.detalle_orden?.length > 0 && (
                      <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full text-left text-xs">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="py-1 pr-3">Código</th>
                              <th className="py-1 pr-3">Descripción</th>
                              <th className="py-1 pr-3">Cant.</th>
                              <th className="py-1 text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orden.detalle_orden.map((d, i) => (
                              <tr key={i} className="border-t border-gray-100">
                                <td className="py-1.5 pr-3 font-mono">
                                  {d.productos?.codigo}
                                </td>
                                <td className="py-1.5 pr-3">{d.productos?.descripcion}</td>
                                <td className="py-1.5 pr-3">{d.cantidad}</td>
                                <td className="py-1.5 text-right">{formatMXN(d.subtotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import StatusBadge from '../../components/StatusBadge'
import {
  getComprobanteAdminUrl,
  getOrdenPdfAdminUrl,
  obtenerTodasOrdenes,
  validarComprobante,
  rechazarComprobante,
} from '../../lib/admin/ordenes'
import { CATEGORIAS } from '../../lib/constants'
import { getSafeErrorMessage } from '../../lib/errors'
import { formatMXN } from '../../lib/pricing'

function formatFecha(iso) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export default function OrdenesAdmin() {
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('pendiente')
  const [expandedId, setExpandedId] = useState(null)
  const [notas, setNotas] = useState({})
  const [motivosRechazo, setMotivosRechazo] = useState({})
  const [validando, setValidando] = useState(null)
  const [rechazando, setRechazando] = useState(null)

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

  async function handleValidar(comprobanteId) {
    setValidando(comprobanteId)
    setError('')
    try {
      await validarComprobante(comprobanteId, notas[comprobanteId] ?? '')
      await cargarOrdenes()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo validar el comprobante'))
    } finally {
      setValidando(null)
    }
  }

  async function handleRechazar(comprobanteId) {
    const motivo = motivosRechazo[comprobanteId]?.trim() ?? ''
    if (motivo.length < 5) {
      setError('Indique el motivo del rechazo (mínimo 5 caracteres)')
      return
    }

    setRechazando(comprobanteId)
    setError('')
    try {
      await rechazarComprobante(comprobanteId, motivo)
      setMotivosRechazo((prev) => ({ ...prev, [comprobanteId]: '' }))
      await cargarOrdenes()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo rechazar el comprobante'))
    } finally {
      setRechazando(null)
    }
  }

  async function handleVerComprobante(path) {
    try {
      const url = await getComprobanteAdminUrl(path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setError('No se pudo abrir el comprobante')
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

  const pendientesValidacion = ordenes.filter((o) =>
    o.comprobantes?.some((c) => !c.validado && !c.rechazado),
  )

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">Órdenes</h1>
      <p className="mt-1 text-sm text-gray-500">
        Validación de comprobantes y seguimiento de pagos
      </p>

      {pendientesValidacion.length > 0 && filtroStatus === 'pendiente' && (
        <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {pendientesValidacion.length} orden(es) con comprobante pendiente de validación
        </div>
      )}

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
            const comprobante = orden.comprobantes?.[0]
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
                      {orden.clientes?.nombre} — {CATEGORIAS[orden.categoria]}
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

                    <button
                      type="button"
                      onClick={() => handleVerPdf(orden)}
                      className="mt-2 text-sm text-labotec-teal hover:underline"
                    >
                      Ver PDF de orden
                    </button>

                    {comprobante ? (
                      <div className="mt-4 rounded-lg bg-gray-50 p-4">
                        <p className="text-sm font-medium text-gray-800">Comprobante de pago</p>
                        <p className="mt-1 text-xs text-gray-500">
                          Subido: {formatFecha(comprobante.creado_en)}
                        </p>

                        <button
                          type="button"
                          onClick={() => handleVerComprobante(comprobante.url_archivo)}
                          className="mt-2 text-sm text-labotec-teal hover:underline"
                        >
                          Ver comprobante
                        </button>

                        {!comprobante.validado && !comprobante.rechazado && orden.status === 'pendiente' && (
                          <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-600">
                                Notas al aprobar (opcional)
                              </label>
                              <input
                                type="text"
                                value={notas[comprobante.id] ?? ''}
                                onChange={(e) =>
                                  setNotas((prev) => ({
                                    ...prev,
                                    [comprobante.id]: e.target.value,
                                  }))
                                }
                                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                                placeholder="Referencia interna…"
                              />
                              <button
                                type="button"
                                disabled={validando === comprobante.id || rechazando === comprobante.id}
                                onClick={() => handleValidar(comprobante.id)}
                                className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                              >
                                {validando === comprobante.id
                                  ? 'Validando…'
                                  : 'Validar y marcar como pagada'}
                              </button>
                            </div>

                            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                              <label className="block text-xs font-medium text-red-800">
                                Motivo del rechazo (requerido)
                              </label>
                              <textarea
                                value={motivosRechazo[comprobante.id] ?? ''}
                                onChange={(e) =>
                                  setMotivosRechazo((prev) => ({
                                    ...prev,
                                    [comprobante.id]: e.target.value,
                                  }))
                                }
                                rows={2}
                                className="mt-1 w-full rounded border border-red-200 px-2 py-1 text-sm"
                                placeholder="Ej: El monto no coincide, imagen ilegible, cuenta incorrecta…"
                              />
                              <button
                                type="button"
                                disabled={rechazando === comprobante.id || validando === comprobante.id}
                                onClick={() => handleRechazar(comprobante.id)}
                                className="mt-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                              >
                                {rechazando === comprobante.id
                                  ? 'Rechazando…'
                                  : 'Rechazar comprobante'}
                              </button>
                            </div>
                          </div>
                        )}

                        {comprobante.validado && (
                          <p className="mt-2 text-xs text-green-700">
                            Validado el {formatFecha(comprobante.validado_en)}
                            {comprobante.notas_admin && (
                              <> — {comprobante.notas_admin}</>
                            )}
                          </p>
                        )}

                        {comprobante.rechazado && (
                          <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                            <p className="font-medium">
                              Rechazado el {formatFecha(comprobante.rechazado_en)}
                            </p>
                            <p className="mt-1">Motivo: {comprobante.notas_admin}</p>
                            <p className="mt-1 text-red-600">
                              El cliente puede subir un nuevo comprobante.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-gray-500">Sin comprobante subido</p>
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

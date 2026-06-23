import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import ComprobanteUpload from '../../components/ComprobanteUpload'
import StatusBadge from '../../components/StatusBadge'
import { getComprobanteSignedUrl } from '../../lib/comprobantes'
import { CATEGORIAS } from '../../lib/constants'
import { getSafeErrorMessage } from '../../lib/errors'
import { obtenerMisOrdenes, getOrdenPdfUrl } from '../../lib/ordenes'
import { formatMXN } from '../../lib/pricing'

function formatFecha(iso) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export default function MisOrdenes() {
  const { cliente } = useAuth()
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [filtroStatus, setFiltroStatus] = useState('')

  const cargarOrdenes = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await obtenerMisOrdenes()
      setOrdenes(data)
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudieron cargar las órdenes'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarOrdenes()
  }, [cargarOrdenes])

  async function handleDescargarPdf(orden) {
    if (!cliente) return
    try {
      const url = await getOrdenPdfUrl(orden, cliente.id)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setError('No se pudo abrir el PDF')
    }
  }

  async function handleVerComprobante(path) {
    try {
      const url = await getComprobanteSignedUrl(path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setError('No se pudo abrir el comprobante')
    }
  }

  const ordenesFiltradas = filtroStatus
    ? ordenes.filter((o) => o.status === filtroStatus)
    : ordenes

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis órdenes</h1>
          <p className="mt-1 text-sm text-gray-500">Historial y comprobantes de pago</p>
        </div>

        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
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
      ) : ordenesFiltradas.length === 0 ? (
        <p className="mt-12 text-center text-gray-500">No tiene órdenes registradas</p>
      ) : (
        <div className="mt-6 space-y-4">
          {ordenesFiltradas.map((orden) => {
            const comprobante = orden.comprobantes?.[0]
            const expanded = expandedId === orden.id
            const puedeSubirComprobante =
              orden.status === 'pendiente' && !comprobante

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
                      {CATEGORIAS[orden.categoria]} — {formatMXN(orden.total)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">{formatFecha(orden.creado_en)}</p>
                  </div>
                  <StatusBadge status={orden.status} />
                </button>

                {expanded && (
                  <div className="border-t border-gray-100 px-4 pb-4">
                    <p className="mt-3 font-mono text-xs text-gray-400">{orden.id}</p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleDescargarPdf(orden)}
                        className="text-sm text-labotec-teal hover:underline"
                      >
                        Descargar PDF
                      </button>
                    </div>

                    {comprobante && (
                      <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">
                        <p className="font-medium text-gray-700">Comprobante</p>
                        <p className="mt-1 text-xs text-gray-500">
                          Subido: {formatFecha(comprobante.creado_en)}
                          {comprobante.validado && comprobante.validado_en && (
                            <> — Validado: {formatFecha(comprobante.validado_en)}</>
                          )}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleVerComprobante(comprobante.url_archivo)}
                          className="mt-2 text-xs text-labotec-teal hover:underline"
                        >
                          Ver comprobante
                        </button>
                        {!comprobante.validado && (
                          <p className="mt-2 text-xs text-amber-700">En revisión por administración</p>
                        )}
                        {comprobante.notas_admin && (
                          <p className="mt-2 text-xs text-gray-600">
                            Notas: {comprobante.notas_admin}
                          </p>
                        )}
                      </div>
                    )}

                    <ComprobanteUpload
                      ordenId={orden.id}
                      disabled={!puedeSubirComprobante}
                      onSuccess={cargarOrdenes}
                    />

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
                            {orden.detalle_orden.map((d) => (
                              <tr key={d.id} className="border-t border-gray-100">
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

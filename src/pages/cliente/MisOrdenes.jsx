import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useCategorias } from '../../hooks/useCategorias'
import ComprobanteUpload from '../../components/ComprobanteUpload'
import DetalleOrdenTabla from '../../components/DetalleOrdenTabla'
import StatusBadge from '../../components/StatusBadge'
import { getComprobanteSignedUrl } from '../../lib/comprobantes'
import { getSafeErrorMessage } from '../../lib/errors'
import { obtenerMisOrdenes, getOrdenPdfUrl, cancelarOrden, puedeCancelarOrden } from '../../lib/ordenes'
import { formatMXN } from '../../lib/pricing'

function formatFecha(iso) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export default function MisOrdenes() {
  const { cliente } = useAuth()
  const { getNombreCategoria } = useCategorias()
  const [searchParams] = useSearchParams()
  const ordenDestacada = searchParams.get('orden')
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [confirmarCancelar, setConfirmarCancelar] = useState(null)
  const [cancelando, setCancelando] = useState(false)
  const [mostrarExitoComprobante, setMostrarExitoComprobante] = useState(false)

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

  useEffect(() => {
    if (ordenDestacada && ordenes.some((o) => o.id === ordenDestacada)) {
      setExpandedId(ordenDestacada)
    }
  }, [ordenDestacada, ordenes])

  async function handleComprobanteSubido() {
    setMostrarExitoComprobante(true)
    await cargarOrdenes()
  }

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

  async function handleCancelarOrden() {
    if (!confirmarCancelar) return
    if (!puedeCancelarOrden(confirmarCancelar)) {
      setConfirmarCancelar(null)
      setError(
        'No puede cancelar esta orden: ya subió un comprobante de pago o está en revisión',
      )
      return
    }
    setCancelando(true)
    setError('')
    try {
      const ordenId = confirmarCancelar.id
      await cancelarOrden(ordenId)
      setConfirmarCancelar(null)
      setExpandedId((prev) => (prev === ordenId ? null : prev))
      await cargarOrdenes()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo cancelar la orden'))
    } finally {
      setCancelando(false)
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
              orden.status === 'pendiente' &&
              (!comprobante || comprobante.rechazado)
            const puedeCancelar = puedeCancelarOrden(orden)

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
                      {getNombreCategoria(orden.categoria)} — {formatMXN(orden.total)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">{formatFecha(orden.creado_en)}</p>
                  </div>
                  <StatusBadge status={orden.status} />
                </button>

                {expanded && (
                  <div className="border-t border-gray-100 px-4 pb-4">
                    <p className="mt-3 font-mono text-xs text-gray-400">{orden.id}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleDescargarPdf(orden)}
                        className="text-sm text-labotec-teal hover:underline"
                      >
                        Descargar PDF
                      </button>
                      {puedeCancelar && (
                        <button
                          type="button"
                          onClick={() => setConfirmarCancelar(orden)}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Cancelar orden
                        </button>
                      )}
                    </div>

                    {puedeCancelar && (
                      <p className="mt-2 text-xs text-gray-500">
                        Puede cancelar mientras no haya subido un comprobante de pago.
                      </p>
                    )}

                    {comprobante && (
                      <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">
                        <p className="font-medium text-gray-700">Comprobante</p>
                        <p className="mt-1 text-xs text-gray-500">
                          Subido: {formatFecha(comprobante.creado_en)}
                          {comprobante.validado && comprobante.validado_en && (
                            <> — Validado: {formatFecha(comprobante.validado_en)}</>
                          )}
                        </p>
                        {!comprobante.rechazado && (
                          <button
                            type="button"
                            onClick={() => handleVerComprobante(comprobante.url_archivo)}
                            className="mt-2 text-xs text-labotec-teal hover:underline"
                          >
                            Ver comprobante
                          </button>
                        )}
                        {!comprobante.validado && !comprobante.rechazado && (
                          <p className="mt-2 text-xs text-amber-700">
                            En revisión por administración
                          </p>
                        )}
                        {comprobante.validado && comprobante.notas_admin && (
                          <p className="mt-2 text-xs text-gray-600">
                            Notas: {comprobante.notas_admin}
                          </p>
                        )}
                        {comprobante.rechazado && (
                          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                            <p className="font-semibold">Comprobante rechazado</p>
                            {comprobante.rechazado_en && (
                              <p className="mt-1 text-red-600">
                                {formatFecha(comprobante.rechazado_en)}
                              </p>
                            )}
                            <p className="mt-2">
                              <span className="font-medium">Motivo: </span>
                              {comprobante.notas_admin || 'Sin detalle'}
                            </p>
                            <p className="mt-2 text-red-700">
                              Suba un nuevo comprobante corregido.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <ComprobanteUpload
                      ordenId={orden.id}
                      disabled={!puedeSubirComprobante}
                      onSuccess={handleComprobanteSubido}
                    />

                    {orden.detalle_orden?.length > 0 && (
                      <DetalleOrdenTabla orden={orden} />
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {mostrarExitoComprobante && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-labelledby="comprobante-exito-titulo"
          >
            <h2 id="comprobante-exito-titulo" className="text-lg font-semibold text-gray-900">
              Comprobante recibido
            </h2>
            <p className="mt-3 text-sm text-gray-600">
              Su comprobante de pago fue enviado correctamente. Su orden está siendo revisada por
              administración.
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Esté al tanto de sus{' '}
              <Link
                to="/notificaciones"
                className="font-medium text-labotec-teal hover:underline"
                onClick={() => setMostrarExitoComprobante(false)}
              >
                notificaciones
              </Link>
              : le avisaremos cuando su pago sea aprobado o si necesitamos un comprobante corregido.
            </p>
            <button
              type="button"
              onClick={() => setMostrarExitoComprobante(false)}
              className="mt-6 w-full rounded-lg bg-labotec-teal py-2.5 text-sm font-semibold text-white hover:bg-labotec-teal-dark"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {confirmarCancelar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Cancelar orden</h2>
            <p className="mt-3 text-sm text-gray-600">
              ¿Cancelar la orden de{' '}
              <strong>{getNombreCategoria(confirmarCancelar.categoria)}</strong> por{' '}
              <strong>{formatMXN(confirmarCancelar.total)}</strong>?
            </p>
            <p className="mt-2 text-xs text-amber-700">
              Esta acción no se puede deshacer. Solo es posible si no ha subido un comprobante.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                disabled={cancelando}
                onClick={() => setConfirmarCancelar(null)}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={cancelando}
                onClick={handleCancelarOrden}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {cancelando ? 'Cancelando…' : 'Confirmar cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

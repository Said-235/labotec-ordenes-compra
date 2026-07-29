import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNotificaciones } from '../../hooks/useNotificaciones'
import { getSafeErrorMessage } from '../../lib/errors'
import {
  listarNotificaciones,
  marcarNotificacionLeida,
} from '../../lib/notificaciones'

function formatFecha(iso) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function iconoTipo(tipo) {
  if (tipo === 'comprobante_aprobado') {
    return { symbol: '✓', className: 'bg-green-100 text-green-700' }
  }
  return { symbol: '!', className: 'bg-red-100 text-red-700' }
}

export default function Notificaciones() {
  const { marcarTodasLeidas, refresh: refreshBadge } = useNotificaciones()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [procesando, setProcesando] = useState(false)

  const cargar = useCallback(async ({ marcarAlEntrar = false } = {}) => {
    setLoading(true)
    setError('')
    try {
      const data = await listarNotificaciones()
      const tieneNoLeidas = data.some((n) => !n.leida)

      if (marcarAlEntrar && tieneNoLeidas) {
        await marcarTodasLeidas()
        setItems(data.map((n) => ({ ...n, leida: true })))
      } else {
        setItems(data)
        if (tieneNoLeidas) {
          await refreshBadge()
        }
      }
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudieron cargar las notificaciones'))
    } finally {
      setLoading(false)
    }
  }, [marcarTodasLeidas, refreshBadge])

  useEffect(() => {
    cargar({ marcarAlEntrar: true })
  }, [cargar])

  async function handleMarcarLeida(notif) {
    if (notif.leida) return
    try {
      await marcarNotificacionLeida(notif.id)
      setItems((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, leida: true } : n)),
      )
      await refreshBadge()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo marcar la notificación'))
    }
  }

  async function handleMarcarTodas() {
    setProcesando(true)
    setError('')
    try {
      await marcarTodasLeidas()
      setItems((prev) => prev.map((n) => ({ ...n, leida: true })))
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudieron marcar las notificaciones'))
    } finally {
      setProcesando(false)
    }
  }

  const noLeidas = items.filter((n) => !n.leida).length

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
          <p className="mt-1 text-sm text-gray-500">
            Avisos cuando su comprobante de pago es aprobado o rechazado
          </p>
        </div>
        {noLeidas > 0 && (
          <button
            type="button"
            disabled={procesando}
            onClick={handleMarcarTodas}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {procesando ? 'Marcando…' : 'Marcar todas como leídas'}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="mt-12 flex justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-labotec-teal border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
          <p className="text-gray-600">No tiene notificaciones por ahora.</p>
          <p className="mt-2 text-sm text-gray-400">
            Cuando validemos o rechacemos un comprobante, el aviso aparecerá aquí.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((notif) => {
            const icono = iconoTipo(notif.tipo)
            return (
              <li
                key={notif.id}
                className={`rounded-xl border bg-white shadow-sm transition ${
                  notif.leida ? 'border-gray-200' : 'border-labotec-teal/40 bg-teal-50/30'
                }`}
              >
                <div className="flex gap-4 p-4">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${icono.className}`}
                  >
                    {icono.symbol}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className={`text-sm font-semibold ${notif.leida ? 'text-gray-700' : 'text-gray-900'}`}>
                        {notif.titulo}
                      </p>
                      <time className="shrink-0 text-xs text-gray-400">
                        {formatFecha(notif.creado_en)}
                      </time>
                    </div>
                    {notif.mensaje && (
                      <p className="mt-1 text-sm text-gray-600">{notif.mensaje}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-3">
                      <Link
                        to={`/mis-ordenes?orden=${notif.orden_id}`}
                        onClick={() => handleMarcarLeida(notif)}
                        className="text-xs font-medium text-labotec-teal hover:underline"
                      >
                        Ver orden
                      </Link>
                      {!notif.leida && (
                        <button
                          type="button"
                          onClick={() => handleMarcarLeida(notif)}
                          className="text-xs text-gray-500 hover:text-gray-800"
                        >
                          Marcar como leída
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

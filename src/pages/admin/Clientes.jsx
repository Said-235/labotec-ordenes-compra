import { useCallback, useEffect, useState } from 'react'
import ConfirmacionModal from '../../components/ConfirmacionModal'
import {
  actualizarCliente,
  crearCliente,
  desactivarCliente,
  eliminarCliente,
  listarClientes,
  reactivarCliente,
  restablecerPasswordCliente,
} from '../../lib/admin/clientes'
import { CLASES_PRODUCTO } from '../../lib/constants'
import { getSafeErrorMessage } from '../../lib/errors'
import { aumentosPorClaseVacios, normalizarAumentosPorClase } from '../../lib/pricing'

const CLASES_CORTAS = {
  Reactivo: 'React.',
  Calibrador: 'Calib.',
  Control: 'Ctrl.',
  Consumible: 'Cons.',
  MCC: 'MCC',
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

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [modalCrear, setModalCrear] = useState(false)
  const [modalPassword, setModalPassword] = useState(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState(null)
  const [formCrear, setFormCrear] = useState({
    nombre: '',
    email: '',
    password: '',
    aumentos_por_clase: aumentosPorClaseVacios(),
  })
  const [passwordNueva, setPasswordNueva] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const lista = await listarClientes()
      setClientes(lista)
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudieron cargar los clientes'))
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
      await crearCliente({
        nombre: formCrear.nombre,
        email: formCrear.email,
        password: formCrear.password,
        aumentos_por_clase: formCrear.aumentos_por_clase,
      })
      setModalCrear(false)
      setFormCrear({
        nombre: '',
        email: '',
        password: '',
        aumentos_por_clase: aumentosPorClaseVacios(),
      })
      flash('Cliente creado correctamente')
      await cargar()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo crear el cliente'))
    } finally {
      setGuardando(false)
    }
  }

  async function handleCambioAumentos(clienteId, aumentos) {
    setError('')
    try {
      await actualizarCliente(clienteId, { aumentos_por_clase: aumentos })
      flash('Aumentos actualizados')
      await cargar()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudieron actualizar los aumentos'))
    }
  }

  async function handleToggleActivo(cliente) {
    setError('')
    try {
      const result = cliente.activo
        ? await desactivarCliente(cliente.id)
        : await reactivarCliente(cliente.id)

      const activo = result?.activo === true
      setClientes((prev) =>
        prev.map((c) => (c.id === cliente.id ? { ...c, activo } : c)),
      )
      flash(activo ? 'Cliente reactivado' : 'Cliente desactivado')
      // No recargar de inmediato: la lista ya refleja el nuevo estado.
      // Recarga en segundo plano por si hay otros campos desfasados.
      cargar().catch(() => {})
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo cambiar el estado'))
    }
  }

  async function handleEliminarCliente() {
    if (!confirmarEliminar) return
    setEliminando(true)
    setError('')
    try {
      await eliminarCliente(confirmarEliminar.id)
      setConfirmarEliminar(null)
      flash('Cliente eliminado')
      await cargar()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo eliminar el cliente'))
    } finally {
      setEliminando(false)
    }
  }

  async function handleRestablecerPassword(event) {
    event.preventDefault()
    if (!modalPassword) return
    setGuardando(true)
    setError('')
    try {
      await restablecerPasswordCliente(modalPassword.id, passwordNueva)
      setModalPassword(null)
      setPasswordNueva('')
      flash('Contraseña restablecida')
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo restablecer la contraseña'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Crear cuentas y asignar el aumento de precio por clase de producto
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalCrear(true)}
          className="rounded-lg bg-labotec-teal px-4 py-2 text-sm font-semibold text-white hover:bg-labotec-teal-dark"
        >
          + Nuevo cliente
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div>
      )}

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
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Aumentos por clase (%)</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Órdenes</th>
                <th className="px-4 py-3">Datos fiscales</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clientes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No hay clientes registrados
                  </td>
                </tr>
              ) : (
                clientes.map((c) => (
                  <tr key={c.id} className={!c.activo ? 'bg-gray-50 opacity-70' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 font-medium">{c.nombre}</td>
                    <td className="px-4 py-3 text-gray-600">{c.email}</td>
                    <td className="px-4 py-3">
                      <AumentosPorClaseEditor
                        valor={normalizarAumentosPorClase(c)}
                        disabled={!c.activo}
                        onSave={(aumentos) => handleCambioAumentos(c.id, aumentos)}
                        compact
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.activo
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {c.activo ? 'Activo' : 'Desactivado'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.tiene_ordenes_pendientes ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Pendientes
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Sin pendientes</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {c.primer_login ? 'Pendiente' : 'Completados'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setModalPassword(c)}
                          className="text-xs text-labotec-teal hover:underline"
                        >
                          Contraseña
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActivo(c)}
                          className={`text-xs hover:underline ${
                            c.activo ? 'text-amber-700' : 'text-green-600'
                          }`}
                        >
                          {c.activo ? 'Desactivar' : 'Reactivar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmarEliminar(c)}
                          disabled={c.tiene_ordenes_pendientes}
                          title={
                            c.tiene_ordenes_pendientes
                              ? 'No se puede eliminar con órdenes pendientes'
                              : undefined
                          }
                          className={`text-xs hover:underline ${
                            c.tiene_ordenes_pendientes
                              ? 'cursor-not-allowed text-gray-400'
                              : 'text-red-600'
                          }`}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalCrear} onClose={() => setModalCrear(false)} title="Nuevo cliente">
        <form onSubmit={handleCrear} className="space-y-4">
          <Field
            label="Nombre / Razón social"
            value={formCrear.nombre}
            onChange={(v) => setFormCrear((f) => ({ ...f, nombre: v }))}
            required
          />
          <Field
            label="Correo electrónico"
            type="email"
            value={formCrear.email}
            onChange={(v) => setFormCrear((f) => ({ ...f, email: v }))}
            required
          />
          <Field
            label="Contraseña temporal"
            type="password"
            value={formCrear.password}
            onChange={(v) => setFormCrear((f) => ({ ...f, password: v }))}
            required
            hint="Mínimo 8 caracteres. El cliente debería cambiarla."
          />
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">
              Aumento sobre precio base por clase (%)
            </p>
            <AumentosPorClaseEditor
              valor={formCrear.aumentos_por_clase}
              onChange={(aumentos) =>
                setFormCrear((f) => ({ ...f, aumentos_por_clase: aumentos }))
              }
            />
            <p className="mt-1 text-xs text-gray-400">
              Ej. Reactivo 10 y Calibrador 25 → cada clase usa su propio %.
            </p>
          </div>
          <button
            type="submit"
            disabled={guardando}
            className="w-full rounded-lg bg-labotec-teal py-2.5 text-sm font-semibold text-white hover:bg-labotec-teal-dark disabled:opacity-60"
          >
            {guardando ? 'Creando…' : 'Crear cliente'}
          </button>
        </form>
      </Modal>

      <ConfirmacionModal
        titulo="Eliminar cliente"
        mensaje={
          confirmarEliminar
            ? `Se eliminará permanentemente a «${confirmarEliminar.nombre}» (${confirmarEliminar.email}), su cuenta de acceso y su historial de órdenes (pagadas/canceladas).\n\nNo es posible si tiene órdenes pendientes: desactívelo o resuelva esas órdenes primero.`
            : null
        }
        onConfirmar={handleEliminarCliente}
        onCancelar={() => setConfirmarEliminar(null)}
        confirmarTexto="Eliminar"
        confirmando={eliminando}
        confirmandoTexto="Eliminando…"
      />

      <Modal
        open={Boolean(modalPassword)}
        onClose={() => {
          setModalPassword(null)
          setPasswordNueva('')
        }}
        title={`Restablecer contraseña — ${modalPassword?.nombre}`}
      >
        <form onSubmit={handleRestablecerPassword} className="space-y-4">
          <Field
            label="Nueva contraseña"
            type="password"
            value={passwordNueva}
            onChange={setPasswordNueva}
            required
            hint="Mínimo 8 caracteres"
          />
          <button
            type="submit"
            disabled={guardando}
            className="w-full rounded-lg bg-labotec-teal py-2.5 text-sm font-semibold text-white hover:bg-labotec-teal-dark disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : 'Restablecer'}
          </button>
        </form>
      </Modal>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required, hint, min, max, step }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-labotec-teal focus:outline-none"
      />
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function AumentosPorClaseEditor({ valor, onSave, onChange, disabled, compact = false }) {
  const [local, setLocal] = useState(() => normalizarAumentosPorClase(valor))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLocal(normalizarAumentosPorClase(valor))
  }, [valor])

  function updateClase(clase, raw) {
    const next = { ...local, [clase]: raw }
    setLocal(next)
    onChange?.(normalizarAumentosPorClase(next))
  }

  async function handleBlur() {
    if (!onSave || disabled) return
    const normalizado = normalizarAumentosPorClase(local)
    const actual = normalizarAumentosPorClase(valor)
    const cambio = CLASES_PRODUCTO.some(
      (clase) => Number(normalizado[clase]) !== Number(actual[clase]),
    )
    if (!cambio) return
    setSaving(true)
    await onSave(normalizado)
    setSaving(false)
  }

  return (
    <div className={compact ? 'flex flex-wrap gap-2' : 'grid grid-cols-2 gap-3 sm:grid-cols-3'}>
      {CLASES_PRODUCTO.map((clase) => (
        <label key={clase} className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
            {compact ? CLASES_CORTAS[clase] : clase}
          </span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={999.99}
              step={0.01}
              value={local[clase]}
              onChange={(e) => updateClase(clase, e.target.value)}
              onBlur={handleBlur}
              disabled={disabled || saving}
              className={`rounded border border-gray-300 px-2 py-1 text-sm disabled:cursor-not-allowed ${
                compact ? 'w-16' : 'w-full'
              }`}
            />
            {!compact && <span className="text-sm text-gray-500">%</span>}
          </div>
        </label>
      ))}
    </div>
  )
}

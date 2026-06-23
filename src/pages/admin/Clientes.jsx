import { useCallback, useEffect, useState } from 'react'
import {
  actualizarCliente,
  actualizarDescuentoNivel,
  crearCliente,
  desactivarCliente,
  listarClientes,
  obtenerDescuentosNivel,
  reactivarCliente,
  restablecerPasswordCliente,
} from '../../lib/admin/clientes'
import { NIVELES_CLIENTE } from '../../lib/constants'
import { getSafeErrorMessage } from '../../lib/errors'

const NIVEL_OPTIONS = [
  { value: 1, label: '1 — Estándar' },
  { value: 2, label: '2 — Preferente' },
  { value: 3, label: '3 — Premium' },
]

function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
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
  const [descuentos, setDescuentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [modalCrear, setModalCrear] = useState(false)
  const [modalPassword, setModalPassword] = useState(null)
  const [formCrear, setFormCrear] = useState({
    nombre: '',
    email: '',
    password: '',
    nivel: 1,
  })
  const [passwordNueva, setPasswordNueva] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [lista, desc] = await Promise.all([
        listarClientes(),
        obtenerDescuentosNivel(),
      ])
      setClientes(lista)
      setDescuentos(desc)
    } catch (err) {
      setError(getSafeErrorMessage(err, 'Error al cargar datos'))
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
      await crearCliente(formCrear)
      setModalCrear(false)
      setFormCrear({ nombre: '', email: '', password: '', nivel: 1 })
      flash('Cliente creado correctamente')
      await cargar()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo crear el cliente'))
    } finally {
      setGuardando(false)
    }
  }

  async function handleCambioNivel(clienteId, nivel) {
    setError('')
    try {
      await actualizarCliente(clienteId, { nivel: Number(nivel) })
      flash('Nivel actualizado')
      await cargar()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo cambiar el nivel'))
    }
  }

  async function handleToggleActivo(cliente) {
    setError('')
    try {
      if (cliente.activo) {
        await desactivarCliente(cliente.id)
        flash('Cliente desactivado')
      } else {
        await reactivarCliente(cliente.id)
        flash('Cliente reactivado')
      }
      await cargar()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo cambiar el estado'))
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

  async function handleGuardarDescuento(nivel, valor) {
    setError('')
    try {
      await actualizarDescuentoNivel(nivel, valor)
      flash(`Descuento nivel ${nivel} actualizado`)
      await cargar()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo guardar el descuento'))
    }
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Crear cuentas, asignar nivel y configurar descuentos
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

      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">Descuentos por nivel</h2>
        <p className="mt-1 text-xs text-gray-500">
          Solo afecta órdenes futuras. Las existentes conservan su snapshot.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {descuentos.map((d) => (
            <DescuentoInput
              key={d.nivel}
              nivel={d.nivel}
              valor={d.porcentaje_descuento}
              onSave={handleGuardarDescuento}
            />
          ))}
        </div>
      </section>

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
                <th className="px-4 py-3">Nivel</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Datos fiscales</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clientes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No hay clientes registrados
                  </td>
                </tr>
              ) : (
                clientes.map((c) => (
                  <tr key={c.id} className={!c.activo ? 'bg-gray-50 opacity-70' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 font-medium">{c.nombre}</td>
                    <td className="px-4 py-3 text-gray-600">{c.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={c.nivel}
                        disabled={!c.activo}
                        onChange={(e) => handleCambioNivel(c.id, e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-sm disabled:cursor-not-allowed"
                      >
                        {NIVEL_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.activo
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </span>
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
                            c.activo ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {c.activo ? 'Desactivar' : 'Reactivar'}
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Nivel</label>
            <select
              value={formCrear.nivel}
              onChange={(e) => setFormCrear((f) => ({ ...f, nivel: Number(e.target.value) }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {NIVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
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

function Field({ label, value, onChange, type = 'text', required, hint }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-labotec-teal focus:outline-none"
      />
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function DescuentoInput({ nivel, valor, onSave }) {
  const [local, setLocal] = useState(String(valor))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLocal(String(valor))
  }, [valor])

  async function handleBlur() {
    if (Number(local) === Number(valor)) return
    setSaving(true)
    await onSave(nivel, local)
    setSaving(false)
  }

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <p className="text-sm font-medium text-gray-800">
        Nivel {nivel} — {NIVELES_CLIENTE[nivel]}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={99.99}
          step={0.01}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={handleBlur}
          disabled={saving}
          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <span className="text-sm text-gray-500">%</span>
      </div>
    </div>
  )
}

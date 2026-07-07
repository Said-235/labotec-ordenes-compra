import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  actualizarAdministrador,
  crearAdministrador,
  desactivarAdministrador,
  listarAdministradores,
  reactivarAdministrador,
  restablecerPasswordAdministrador,
} from '../../lib/admin/administradores'
import {
  puedeDesactivarAdmin,
  puedeEditarNombreAdmin,
  puedeRestablecerPasswordAdmin,
} from '../../lib/admin/adminPrincipal'
import { getSafeErrorMessage } from '../../lib/errors'

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

export default function Administradores() {
  const { cliente } = useAuth()
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [modalCrear, setModalCrear] = useState(false)
  const [modalPassword, setModalPassword] = useState(null)
  const [formCrear, setFormCrear] = useState({ nombre: '', email: '', password: '' })
  const [passwordNueva, setPasswordNueva] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listarAdministradores()
      setAdmins(data)
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudieron cargar los administradores'))
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
      await crearAdministrador(formCrear)
      setModalCrear(false)
      setFormCrear({ nombre: '', email: '', password: '' })
      flash('Administrador creado correctamente')
      await cargar()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo crear el administrador'))
    } finally {
      setGuardando(false)
    }
  }

  async function handleToggleActivo(admin) {
    if (!cliente) return
    setError('')
    try {
      if (admin.activo) {
        await desactivarAdministrador(admin.id, cliente.id)
        flash('Administrador desactivado')
      } else {
        await reactivarAdministrador(admin.id)
        flash('Administrador reactivado')
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
      await restablecerPasswordAdministrador(modalPassword.id, passwordNueva)
      setModalPassword(null)
      setPasswordNueva('')
      flash('Contraseña restablecida')
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo restablecer la contraseña'))
    } finally {
      setGuardando(false)
    }
  }

  async function handleCambioNombre(admin, nombre) {
    setError('')
    try {
      await actualizarAdministrador(admin.id, { nombre })
      flash('Nombre actualizado')
      await cargar()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo actualizar el nombre'))
    }
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administradores</h1>
          <p className="mt-1 text-sm text-gray-500">
            Crear cuentas de administración para validar órdenes y gestionar el sistema
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalCrear(true)}
          className="rounded-lg bg-labotec-teal px-4 py-2 text-sm font-semibold text-white hover:bg-labotec-teal-dark"
        >
          + Nuevo administrador
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div>
      )}

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">Administrador principal</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-amber-800">
          <li>Solo él puede cambiar su propia contraseña.</li>
          <li>Ningún otro admin puede modificar su nombre, contraseña ni desactivarlo.</li>
          <li>Los demás administradores sí pueden ser gestionados con normalidad.</li>
        </ul>
        <p className="mt-2 text-amber-800">
          Use contraseñas seguras (mín. 12 caracteres con mayúsculas, minúsculas y números).
        </p>
      </div>

      {loading ? (
        <div className="mt-12 flex justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-labotec-teal border-t-transparent" />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {admins.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No hay administradores registrados
                  </td>
                </tr>
              ) : (
                admins.map((admin) => {
                  const esYo = admin.id === cliente?.id
                  const esPrincipal = Boolean(admin.admin_principal)
                  const puedeCambiarPassword = puedeRestablecerPasswordAdmin(cliente?.id, admin)
                  const puedeEditarNombre = puedeEditarNombreAdmin(cliente?.id, admin)
                  const puedeDesactivar = !esYo && puedeDesactivarAdmin(admin)
                  return (
                    <tr
                      key={admin.id}
                      className={!admin.activo ? 'bg-gray-50 opacity-70' : esPrincipal ? 'bg-amber-50/40' : ''}
                    >
                      <td className="px-4 py-3">
                        {puedeEditarNombre ? (
                          <input
                            type="text"
                            defaultValue={admin.nombre}
                            onBlur={(e) => {
                              if (e.target.value.trim() !== admin.nombre) {
                                handleCambioNombre(admin, e.target.value.trim())
                              }
                            }}
                            className="w-full min-w-[140px] rounded border border-transparent px-1 py-0.5 text-sm hover:border-gray-200 focus:border-labotec-teal focus:outline-none"
                          />
                        ) : (
                          <span className="block px-1 py-0.5 text-sm font-medium text-gray-900">
                            {admin.nombre}
                          </span>
                        )}
                        {esYo && (
                          <span className="mt-1 block text-xs text-labotec-teal">Su cuenta</span>
                        )}
                        {esPrincipal && (
                          <span className="mt-1 block text-xs font-medium text-amber-700">
                            Administrador principal
                          </span>
                        )}
                        {!puedeEditarNombre && !esYo && esPrincipal && (
                          <span className="mt-1 block text-xs text-gray-400">Nombre protegido</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{admin.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            admin.activo
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {admin.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {puedeCambiarPassword ? (
                            <button
                              type="button"
                              onClick={() => setModalPassword(admin)}
                              className="text-xs text-labotec-teal hover:underline"
                            >
                              Contraseña
                            </button>
                          ) : (
                            <span
                              className="text-xs text-gray-400"
                              title="Solo el administrador principal puede cambiar su contraseña"
                            >
                              Contraseña protegida
                            </span>
                          )}
                          {puedeDesactivar ? (
                            <button
                              type="button"
                              onClick={() => handleToggleActivo(admin)}
                              className={`text-xs hover:underline ${
                                admin.activo ? 'text-red-600' : 'text-green-600'
                              }`}
                            >
                              {admin.activo ? 'Desactivar' : 'Reactivar'}
                            </button>
                          ) : (
                            !esYo &&
                            esPrincipal && (
                              <span
                                className="text-xs text-gray-400"
                                title="El administrador principal no puede desactivarse"
                              >
                                Cuenta protegida
                              </span>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalCrear} onClose={() => setModalCrear(false)} title="Nuevo administrador">
        <form onSubmit={handleCrear} className="space-y-4">
          <Field
            label="Nombre completo"
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
            hint="Mín. 12 caracteres, mayúsculas, minúsculas y números"
          />
          <button
            type="submit"
            disabled={guardando}
            className="w-full rounded-lg bg-labotec-teal py-2.5 text-sm font-semibold text-white hover:bg-labotec-teal-dark disabled:opacity-60"
          >
            {guardando ? 'Creando…' : 'Crear administrador'}
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
            hint="Mín. 12 caracteres, mayúsculas, minúsculas y números"
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

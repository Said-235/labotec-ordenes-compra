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
import { listarCategorias } from '../../lib/admin/categorias'
import { CATEGORIA_EXENTA_REGLA_CALIBRADOR, CLASES_PRODUCTO } from '../../lib/constants'
import { getSafeErrorMessage } from '../../lib/errors'
import { aumentosPorClaseVacios, normalizarAumentosPorCategoria } from '../../lib/pricing'

const CLASES_CORTAS = {
  Reactivo: 'Reactivo',
  Calibrador: 'Calibrador',
  Control: 'Control',
  Consumible: 'Consumible',
  MCC: 'MCC',
}

function condicionesIniciales(categorias, fuente = null) {
  const claves = categorias.map((cat) => cat.clave)
  const visiblesFuente = Array.isArray(fuente?.categorias_visibles)
    ? fuente.categorias_visibles.filter((clave) => claves.includes(clave))
    : claves
  return {
    categorias_visibles: fuente ? visiblesFuente : claves,
    aumentos_por_clase: normalizarAumentosPorCategoria(fuente ?? 0, claves),
    aplica_regla_calibrador_control: fuente
      ? fuente.aplica_regla_calibrador_control !== false
      : true,
  }
}

function resumenAumentos(mapa, visibles) {
  const valores = []
  for (const clave of visibles) {
    const slice = mapa?.[clave]
    if (!slice || typeof slice !== 'object') continue
    for (const clase of CLASES_PRODUCTO) {
      const pct = Number(slice[clase])
      if (Number.isFinite(pct)) valores.push(pct)
    }
  }
  if (!valores.length) return 'Sin aumentos'
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const texto = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2))
  if (min === max) return `${texto(min)}%`
  return `${texto(min)}–${texto(max)}%`
}

function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white p-6 shadow-xl ${
          wide ? 'max-w-4xl' : 'max-w-lg'
        }`}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
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
  const [catalogo, setCatalogo] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [modalCrear, setModalCrear] = useState(false)
  const [modalEditar, setModalEditar] = useState(null)
  const [modalPassword, setModalPassword] = useState(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState(null)
  const [formCrear, setFormCrear] = useState({
    nombre: '',
    email: '',
    password: '',
    ...condicionesIniciales([]),
  })
  const [formEditar, setFormEditar] = useState(null)
  const [passwordNueva, setPasswordNueva] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  const categoriasActivas = catalogo.filter((cat) => cat.activo !== false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [lista, categorias] = await Promise.all([listarClientes(), listarCategorias()])
      setClientes(lista)
      setCatalogo(categorias ?? [])
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

  function nombreCategoria(clave) {
    return catalogo.find((cat) => cat.clave === clave)?.nombre ?? clave
  }

  function abrirCrear() {
    setError('')
    setFormCrear({
      nombre: '',
      email: '',
      password: '',
      ...condicionesIniciales(categoriasActivas),
    })
    setModalCrear(true)
  }

  function abrirEditar(cliente) {
    setError('')
    setFormEditar({
      id: cliente.id,
      nombre: cliente.nombre,
      ...condicionesIniciales(categoriasActivas, cliente),
    })
    setModalEditar(cliente)
  }

  async function handleCrear(event) {
    event.preventDefault()
    if (!formCrear.categorias_visibles.length) {
      setError('Seleccione al menos una categoría')
      return
    }
    setGuardando(true)
    setError('')
    try {
      await crearCliente({
        nombre: formCrear.nombre,
        email: formCrear.email,
        password: formCrear.password,
        categorias_visibles: formCrear.categorias_visibles,
        aumentos_por_clase: formCrear.aumentos_por_clase,
        aplica_regla_calibrador_control: formCrear.aplica_regla_calibrador_control,
      })
      setModalCrear(false)
      flash('Cliente creado correctamente')
      await cargar()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo crear el cliente'))
    } finally {
      setGuardando(false)
    }
  }

  async function handleGuardarEdicion(event) {
    event.preventDefault()
    if (!formEditar?.categorias_visibles.length) {
      setError('Seleccione al menos una categoría')
      return
    }
    setGuardando(true)
    setError('')
    try {
      await actualizarCliente(formEditar.id, {
        categorias_visibles: formEditar.categorias_visibles,
        aumentos_por_clase: formEditar.aumentos_por_clase,
        aplica_regla_calibrador_control: formEditar.aplica_regla_calibrador_control,
      })
      setModalEditar(null)
      setFormEditar(null)
      flash('Condiciones del cliente actualizadas')
      await cargar()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudieron actualizar las condiciones'))
    } finally {
      setGuardando(false)
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
            Asigne categorías del catálogo y el aumento de precio por clase dentro de cada una
          </p>
        </div>
        <button
          type="button"
          onClick={abrirCrear}
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
                <th className="px-4 py-3">Categorías</th>
                <th className="px-4 py-3">Aumentos</th>
                <th className="px-4 py-3">Regla Cal/Ctrl</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Órdenes</th>
                <th className="px-4 py-3">Datos fiscales</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clientes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No hay clientes registrados
                  </td>
                </tr>
              ) : (
                clientes.map((c) => (
                  <tr key={c.id} className={!c.activo ? 'bg-gray-50 opacity-70' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 font-medium">{c.nombre}</td>
                    <td className="px-4 py-3 text-gray-600">{c.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {(c.categorias_visibles ?? []).length === 0 ? (
                          <span className="text-xs text-gray-400">Ninguna</span>
                        ) : (
                          c.categorias_visibles.map((clave) => (
                            <span
                              key={clave}
                              className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800"
                            >
                              {nombreCategoria(clave)}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {resumenAumentos(c.aumentos_por_clase, c.categorias_visibles ?? [])}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        title={
                          c.aplica_regla_calibrador_control
                            ? 'Aplica en todas las categorías excepto Química clínica'
                            : 'Exento en todas las categorías. Química clínica siempre queda exenta'
                        }
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.aplica_regla_calibrador_control
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {c.aplica_regla_calibrador_control ? 'Aplica' : 'Exento'}
                      </span>
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
                          onClick={() => abrirEditar(c)}
                          disabled={!c.activo}
                          className="text-xs text-labotec-teal hover:underline disabled:cursor-not-allowed disabled:text-gray-400"
                        >
                          Condiciones
                        </button>
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

      <Modal open={modalCrear} onClose={() => setModalCrear(false)} title="Nuevo cliente" wide>
        <form onSubmit={handleCrear} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
          <Field
            label="Contraseña temporal"
            type="password"
            value={formCrear.password}
            onChange={(v) => setFormCrear((f) => ({ ...f, password: v }))}
            required
            hint="Mínimo 8 caracteres. El cliente debería cambiarla."
          />
          <CondicionesFields
            categorias={categoriasActivas}
            value={formCrear}
            onChange={(parcial) => setFormCrear((f) => ({ ...f, ...parcial }))}
          />
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
        open={Boolean(modalEditar && formEditar)}
        onClose={() => {
          setModalEditar(null)
          setFormEditar(null)
        }}
        title={`Condiciones — ${modalEditar?.nombre ?? ''}`}
        wide
      >
        {formEditar && (
          <form onSubmit={handleGuardarEdicion} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            <CondicionesFields
              categorias={categoriasActivas}
              value={formEditar}
              onChange={(parcial) => setFormEditar((f) => ({ ...f, ...parcial }))}
            />
            <button
              type="submit"
              disabled={guardando}
              className="w-full rounded-lg bg-labotec-teal py-2.5 text-sm font-semibold text-white hover:bg-labotec-teal-dark disabled:opacity-60"
            >
              {guardando ? 'Guardando…' : 'Guardar condiciones'}
            </button>
          </form>
        )}
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

function CondicionesFields({ categorias, value, onChange }) {
  function toggleCategoria(clave) {
    const tiene = value.categorias_visibles.includes(clave)
    const categorias_visibles = tiene
      ? value.categorias_visibles.filter((item) => item !== clave)
      : [...value.categorias_visibles, clave]
    const aumentos_por_clase = { ...value.aumentos_por_clase }
    if (!aumentos_por_clase[clave]) {
      aumentos_por_clase[clave] = aumentosPorClaseVacios()
    }
    onChange({ categorias_visibles, aumentos_por_clase })
  }

  function setPorcentaje(clave, clase, raw) {
    onChange({
      aumentos_por_clase: {
        ...value.aumentos_por_clase,
        [clave]: {
          ...aumentosPorClaseVacios(),
          ...value.aumentos_por_clase?.[clave],
          [clase]: raw,
        },
      },
    })
  }

  const filas = categorias.filter((cat) => value.categorias_visibles.includes(cat.clave))

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-800">Categorías del catálogo</p>
        <p className="mt-1 text-xs text-gray-500">
          El cliente solo verá y podrá comprar las categorías marcadas.
        </p>
        {categorias.length === 0 ? (
          <p className="mt-3 text-sm text-amber-800">No hay categorías activas.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {categorias.map((cat) => {
              const marcada = value.categorias_visibles.includes(cat.clave)
              const exenta = cat.clave === CATEGORIA_EXENTA_REGLA_CALIBRADOR
              return (
                <button
                  key={cat.clave}
                  type="button"
                  aria-pressed={marcada}
                  onClick={() => toggleCategoria(cat.clave)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    marcada
                      ? 'border-labotec-teal bg-labotec-teal text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {cat.nombre}
                  {exenta ? ' · exenta' : ''}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-gray-800">Aumento sobre precio base (%)</p>
        <p className="mt-1 text-xs text-gray-500">
          Cada porcentaje aplica solo a esa clase dentro de esa categoría. Al desmarcar una
          categoría se conserva el porcentaje por si vuelve a asignarla.
        </p>
        {filas.length === 0 ? (
          <p className="mt-3 text-sm text-amber-800">Seleccione al menos una categoría.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Categoría</th>
                  {CLASES_PRODUCTO.map((clase) => (
                    <th key={clase} className="px-3 py-2 font-medium">
                      {CLASES_CORTAS[clase]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filas.map((cat) => (
                  <tr key={cat.clave}>
                    <td className="px-3 py-2 font-medium text-gray-800">{cat.nombre}</td>
                    {CLASES_PRODUCTO.map((clase) => (
                      <td key={clase} className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={999.99}
                            step={0.01}
                            aria-label={`${cat.nombre} ${clase}`}
                            value={value.aumentos_por_clase?.[cat.clave]?.[clase] ?? 0}
                            onChange={(e) => setPorcentaje(cat.clave, clase, e.target.value)}
                            className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                          <span className="text-xs text-gray-400">%</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <input
          type="checkbox"
          checked={value.aplica_regla_calibrador_control}
          onChange={(e) => onChange({ aplica_regla_calibrador_control: e.target.checked })}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-labotec-teal focus:ring-labotec-teal"
        />
        <span>
          <span className="block text-sm font-medium text-gray-800">
            Aplicar regla Calibrador / Control
          </span>
          <span className="mt-0.5 block text-xs text-gray-500">
            Si está activa, las unidades de Calibrador o Control que excedan la cantidad de
            Reactivo del mismo grupo se cobran al doble. Química clínica queda siempre exenta
            de esta regla, aunque el cliente la tenga activa o la categoría esté asignada.
          </span>
        </span>
      </label>
    </div>
  )
}

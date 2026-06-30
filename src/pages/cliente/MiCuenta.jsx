import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getSafeErrorMessage } from '../../lib/errors'
import { actualizarPerfilCliente } from '../../lib/perfil'
import { NIVELES_CLIENTE } from '../../lib/constants'
import { esEnvioIgualFiscal } from '../../lib/datosCliente'
import { validatePerfilCliente } from '../../lib/validation'
import DireccionEnvioFields from '../../components/DireccionEnvioFields'

const EMPTY_FORM = {
  nombre: '',
  razon_social: '',
  rfc: '',
  direccion_fiscal: '',
  telefono: '',
  correo_facturacion: '',
  envio_igual_fiscal: true,
  direccion_envio: '',
}

export default function MiCuenta() {
  const { cliente, refreshProfile } = useAuth()
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!cliente) return

    const fiscal = cliente.datos_fiscales ?? {}
    setForm({
      nombre: cliente.nombre ?? '',
      razon_social: fiscal.razon_social ?? '',
      rfc: fiscal.rfc ?? '',
      direccion_fiscal: fiscal.direccion_fiscal ?? '',
      telefono: fiscal.telefono ?? '',
      correo_facturacion: fiscal.correo_facturacion ?? '',
      envio_igual_fiscal: esEnvioIgualFiscal(fiscal),
      direccion_envio: fiscal.direccion_envio ?? '',
    })
  }, [cliente])

  function handleChange(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
    setSuccess('')
  }

  function handleEnvioIgualChange(event) {
    const checked = event.target.checked
    setForm((prev) => ({
      ...prev,
      envio_igual_fiscal: checked,
      direccion_envio: checked ? '' : prev.direccion_envio,
    }))
    setFieldErrors((prev) => ({ ...prev, direccion_envio: undefined }))
    setSuccess('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitError('')
    setSuccess('')

    const { errors } = validatePerfilCliente(form)

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)

    try {
      await actualizarPerfilCliente(form)
      await refreshProfile()
      setSuccess('Sus datos se actualizaron correctamente')
    } catch (err) {
      setSubmitError(getSafeErrorMessage(err, 'No se pudieron guardar los cambios'))
    } finally {
      setSubmitting(false)
    }
  }

  const fiscalFields = [
    { name: 'razon_social', label: 'Razón social', type: 'text' },
    { name: 'rfc', label: 'RFC', type: 'text', placeholder: 'XAXX010101000' },
    { name: 'direccion_fiscal', label: 'Dirección fiscal', type: 'text' },
    { name: 'correo_facturacion', label: 'Correo de facturación', type: 'email' },
  ]

  return (
    <div className="p-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900">Mi cuenta</h1>
        <p className="mt-1 text-sm text-gray-500">
          Actualice sus datos de contacto y fiscales
        </p>

        {cliente && (
          <p className="mt-2 text-xs text-gray-400">
            Nivel {cliente.nivel} — {NIVELES_CLIENTE[cliente.nivel]}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-8" noValidate>
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Datos de contacto</h2>
            <p className="mt-1 text-xs text-gray-500">
              Información para comunicación con Labotec
            </p>

            <div className="mt-4 space-y-4">
              <Field
                name="nombre"
                label="Nombre de contacto"
                type="text"
                value={form.nombre}
                onChange={handleChange}
                error={fieldErrors.nombre}
              />

              <Field
                name="telefono"
                label="Teléfono"
                type="tel"
                value={form.telefono}
                onChange={handleChange}
                error={fieldErrors.telefono}
              />

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Correo de acceso
                </label>
                <input
                  type="email"
                  value={cliente?.email ?? ''}
                  disabled
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                />
                <p className="mt-1 text-xs text-gray-400">
                  El correo de inicio de sesión solo puede cambiarlo un administrador.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Datos fiscales</h2>
            <p className="mt-1 text-xs text-gray-500">
              Se usan en las órdenes de compra y facturación
            </p>

            <div className="mt-4 space-y-4">
              {fiscalFields.map(({ name, label, type, placeholder }) => (
                <Field
                  key={name}
                  name={name}
                  label={label}
                  type={type}
                  placeholder={placeholder}
                  value={form[name]}
                  onChange={handleChange}
                  error={fieldErrors[name]}
                />
              ))}

              <DireccionEnvioFields
                form={form}
                fieldErrors={fieldErrors}
                onEnvioIgualChange={handleEnvioIgualChange}
                onDireccionEnvioChange={handleChange}
              />
            </div>
          </section>

          {submitError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-labotec-teal px-6 py-2.5 text-sm font-semibold text-white hover:bg-labotec-teal-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({ name, label, type, value, onChange, error, placeholder }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-labotec-teal/30 ${
          error ? 'border-red-400' : 'border-gray-300 focus:border-labotec-teal'
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

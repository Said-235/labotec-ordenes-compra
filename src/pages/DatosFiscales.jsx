import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getSafeErrorMessage } from '../lib/errors'
import { validateDatosFiscales } from '../lib/validation'
import DireccionEnvioFields from '../components/DireccionEnvioFields'

export default function DatosFiscales() {
  const { completeDatosFiscales, needsDatosFiscales, isAdmin, loading } = useAuth()

  const [form, setForm] = useState({
    razon_social: '',
    rfc: '',
    direccion_fiscal: '',
    telefono: '',
    correo_facturacion: '',
    envio_igual_fiscal: true,
    direccion_envio: '',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [aceptaCondiciones, setAceptaCondiciones] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && isAdmin) {
    return <Navigate to="/admin" replace />
  }

  if (!loading && !needsDatosFiscales) {
    return <Navigate to="/catalogo" replace />
  }

  function handleChange(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  function handleEnvioIgualChange(event) {
    const checked = event.target.checked
    setForm((prev) => ({
      ...prev,
      envio_igual_fiscal: checked,
      direccion_envio: checked ? '' : prev.direccion_envio,
    }))
    setFieldErrors((prev) => ({ ...prev, direccion_envio: undefined }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitError('')

    const { errors, sanitized } = validateDatosFiscales(form)

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    if (!aceptaCondiciones) {
      setFieldErrors((prev) => ({
        ...prev,
        condiciones_comerciales: 'Debe aceptar las condiciones comerciales para continuar',
      }))
      return
    }

    setSubmitting(true)

    try {
      await completeDatosFiscales({
        ...sanitized,
        condiciones_comerciales_aceptadas: true,
        condiciones_comerciales_aceptadas_en: new Date().toISOString(),
      })
    } catch (err) {
      setSubmitError(getSafeErrorMessage(err, 'No se pudieron guardar los datos fiscales'))
    } finally {
      setSubmitting(false)
    }
  }

  const fields = [
    { name: 'razon_social', label: 'Razón social', type: 'text' },
    { name: 'rfc', label: 'RFC', type: 'text', placeholder: 'XAXX010101000' },
    { name: 'direccion_fiscal', label: 'Dirección fiscal', type: 'text' },
    { name: 'telefono', label: 'Teléfono', type: 'tel' },
    { name: 'correo_facturacion', label: 'Correo de facturación', type: 'email' },
  ]

  const fieldsBeforeEnvio = fields.slice(0, 3)
  const fieldsAfterEnvio = fields.slice(3)

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <div className="mb-6 flex items-center gap-4">
            <img
              src="/logo-labotec.png"
              alt="Labotec"
              className="h-16 w-16 object-contain"
            />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Datos fiscales</h1>
              <p className="text-sm text-gray-500">
                Complete su información antes de acceder al catálogo
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {fieldsBeforeEnvio.map(({ name, label, type, placeholder }) => (
              <div key={name}>
                <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700">
                  {label}
                </label>
                <input
                  id={name}
                  name={name}
                  type={type}
                  value={form[name]}
                  onChange={handleChange}
                  placeholder={placeholder}
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-labotec-teal/30 ${
                    fieldErrors[name] ? 'border-red-400' : 'border-gray-300 focus:border-labotec-teal'
                  }`}
                />
                {fieldErrors[name] && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors[name]}</p>
                )}
              </div>
            ))}

            <DireccionEnvioFields
              form={form}
              fieldErrors={fieldErrors}
              onEnvioIgualChange={handleEnvioIgualChange}
              onDireccionEnvioChange={handleChange}
            />

            {fieldsAfterEnvio.map(({ name, label, type, placeholder }) => (
              <div key={name}>
                <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700">
                  {label}
                </label>
                <input
                  id={name}
                  name={name}
                  type={type}
                  value={form[name]}
                  onChange={handleChange}
                  placeholder={placeholder}
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-labotec-teal/30 ${
                    fieldErrors[name] ? 'border-red-400' : 'border-gray-300 focus:border-labotec-teal'
                  }`}
                />
                {fieldErrors[name] && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors[name]}</p>
                )}
              </div>
            ))}

            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={aceptaCondiciones}
                  onChange={(e) => {
                    setAceptaCondiciones(e.target.checked)
                    setFieldErrors((prev) => ({ ...prev, condiciones_comerciales: undefined }))
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-labotec-teal focus:ring-labotec-teal/30"
                />
                <span className="text-sm text-gray-700">
                  He leído y acepto las{' '}
                  <Link
                    to="/condiciones-comerciales"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-labotec-teal underline hover:text-labotec-teal-dark"
                  >
                    condiciones comerciales
                  </Link>
                  .
                </span>
              </label>
              {fieldErrors.condiciones_comerciales && (
                <p className="mt-2 text-xs text-red-600">{fieldErrors.condiciones_comerciales}</p>
              )}
            </div>

            {submitError && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !aceptaCondiciones}
              className="w-full rounded-lg bg-labotec-teal py-2.5 text-sm font-semibold text-white transition hover:bg-labotec-teal-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Guardando…' : 'Continuar al catálogo'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

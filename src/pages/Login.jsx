import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getSafeErrorMessage } from '../lib/errors'
import { validateLoginInput } from '../lib/validation'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitError('')
    setFieldErrors({})

    const { errors, cleanEmail, cleanPassword } = validateLoginInput(email, password)

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)

    try {
      const profile = await signIn(cleanEmail, cleanPassword)

      if (profile.primer_login && !profile.es_admin) {
        navigate('/datos-fiscales', { replace: true })
      } else if (profile.es_admin) {
        navigate(from?.startsWith('/admin') ? from : '/admin', { replace: true })
      } else {
        navigate(from && !from.startsWith('/admin') ? from : '/catalogo', { replace: true })
      }
    } catch (err) {
      setSubmitError(getSafeErrorMessage(err, 'No se pudo iniciar sesión'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <div className="mb-8 flex flex-col items-center">
            <img
              src="/logo-labotec.png"
              alt="Labotec Engineering Services"
              className="mb-4 h-28 w-28 object-contain"
            />
            <h1 className="text-2xl font-bold text-gray-900">Labotec Supply</h1>
            <p className="mt-1 text-sm text-gray-500">
              Sistema de órdenes de compra
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-labotec-teal/30 ${
                  fieldErrors.email ? 'border-red-400' : 'border-gray-300 focus:border-labotec-teal'
                }`}
                placeholder="usuario@empresa.com"
              />
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-labotec-teal/30 ${
                  fieldErrors.password ? 'border-red-400' : 'border-gray-300 focus:border-labotec-teal'
                }`}
              />
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
              )}
            </div>

            {submitError && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-labotec-teal py-2.5 text-sm font-semibold text-white transition hover:bg-labotec-teal-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

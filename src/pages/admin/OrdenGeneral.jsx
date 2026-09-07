import { useCallback, useEffect, useState } from 'react'
import DireccionEnvioFields from '../../components/DireccionEnvioFields'
import {
  generarOrdenGeneral,
  getOrdenGeneralPdfUrl,
  listarOrdenesGenerales,
  previewOrdenGeneral,
} from '../../lib/admin/ordenGeneral'
import { useCategorias } from '../../hooks/useCategorias'
import { getSafeErrorMessage } from '../../lib/errors'
import { formatMXN } from '../../lib/pricing'
import { validateDatosFiscales, isValidEmail, sanitizeText } from '../../lib/validation'

const FORM_STORAGE_KEY = 'labotec_orden_general_formato'

const emptyForm = {
  folio: '',
  nombre: '',
  email: '',
  razon_social: '',
  rfc: '',
  direccion_fiscal: '',
  telefono: '',
  correo_facturacion: '',
  envio_igual_fiscal: true,
  direccion_envio: '',
}

function formatFecha(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function loadSavedForm() {
  try {
    const raw = localStorage.getItem(FORM_STORAGE_KEY)
    if (!raw) return emptyForm
    return { ...emptyForm, ...JSON.parse(raw) }
  } catch {
    return emptyForm
  }
}

function validateFormatoAdmin(form) {
  const nombre = sanitizeText(form.nombre, 200)
  const email = sanitizeText(form.email, 254).toLowerCase()
  const folio = sanitizeText(form.folio, 80)
  const errors = {}

  if (!nombre) errors.nombre = 'El nombre de contacto es requerido'
  if (!email) {
    errors.email = 'El correo es requerido'
  } else if (!isValidEmail(email)) {
    errors.email = 'Formato de correo inválido'
  }

  const { errors: fiscalErrors, sanitized } = validateDatosFiscales(form)

  return {
    errors: { ...errors, ...fiscalErrors },
    sanitized: {
      folio,
      nombre,
      email,
      ...sanitized,
    },
  }
}

export default function OrdenGeneral() {
  const { getNombreCategoria } = useCategorias()
  const [preview, setPreview] = useState(null)
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState(loadSavedForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [generando, setGenerando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [prev, hist] = await Promise.all([
        previewOrdenGeneral(),
        listarOrdenesGenerales().catch(() => []),
      ])
      setPreview(prev)
      setHistorial(hist)
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo cargar la vista de orden general'))
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

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

  async function handleGenerar(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const { errors, sanitized } = validateFormatoAdmin(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    if (!preview?.totalOrdenes) {
      setError('No hay órdenes pagadas para incluir')
      return
    }

    setGenerando(true)
    try {
      localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(form))
      const result = await generarOrdenGeneral(sanitized)
      setSuccess(
        `Orden general generada (${result.totalOrdenes} órdenes, ${result.totalUnidades} unidades).`,
      )
      if (result.pdfUrl) {
        window.open(result.pdfUrl, '_blank', 'noopener,noreferrer')
      }
      await cargar()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo generar la orden general'))
    } finally {
      setGenerando(false)
    }
  }

  async function handleVerPdf(id) {
    try {
      const url = await getOrdenGeneralPdfUrl(id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo abrir el PDF'))
    }
  }

  const fieldsFiscal = [
    { name: 'razon_social', label: 'Razón social', type: 'text' },
    { name: 'rfc', label: 'RFC', type: 'text', placeholder: 'XAXX010101000' },
    { name: 'direccion_fiscal', label: 'Dirección fiscal', type: 'text' },
    { name: 'telefono', label: 'Teléfono', type: 'tel' },
    { name: 'correo_facturacion', label: 'Correo de facturación', type: 'email' },
  ]

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-gray-900">Orden general al proveedor</h1>
      <p className="mt-2 text-gray-500">
        Consolida las órdenes pagadas de Banco de sangre, Inmuno y Química clínica en un solo
        pedido.
      </p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </div>
      )}

      {loading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-labotec-teal border-t-transparent" />
        </div>
      ) : (
        <>
          <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold text-amber-900">Antes de generar</h2>
            <p className="mt-2 text-sm text-amber-900">
              Última compra confirmada:{' '}
              <span className="font-medium">{formatFecha(preview?.ultimaCompraConfirmada)}</span>
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Se incluirán todas las órdenes pagadas de las 3 categorías hasta esa fecha que aún no
              estén en una orden general: {preview?.totalOrdenes ?? 0} órdenes,{' '}
              {preview?.totalLineas ?? 0} productos distintos, {preview?.totalUnidades ?? 0}{' '}
              unidades.
            </p>
          </section>

          {preview?.lineas?.length > 0 && (
            <>
              <section className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-4 py-3">
                  <h2 className="font-semibold text-gray-900">Productos a incluir</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Importes con precio base del catálogo (sin aumentos de cliente).
                  </p>
                </div>
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2">Código</th>
                      <th className="px-4 py-2">Descripción</th>
                      <th className="px-4 py-2">Clase</th>
                      <th className="px-4 py-2">Categoría</th>
                      <th className="px-4 py-2 text-right">Cant.</th>
                      <th className="px-4 py-2 text-right">P. base</th>
                      <th className="px-4 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.lineas.map((linea) => (
                      <tr
                        key={`${linea.producto_id ?? linea.codigo}-${linea.categoria}`}
                        className="border-t border-gray-100"
                      >
                        <td className="px-4 py-2 font-mono text-xs">{linea.codigo}</td>
                        <td className="px-4 py-2">{linea.descripcion}</td>
                        <td className="px-4 py-2">{linea.clase}</td>
                        <td className="px-4 py-2">{getNombreCategoria(linea.categoria)}</td>
                        <td className="px-4 py-2 text-right font-medium">{linea.cantidad}</td>
                        <td className="px-4 py-2 text-right">{formatMXN(linea.precio_base_unitario)}</td>
                        <td className="px-4 py-2 text-right font-medium">
                          {formatMXN(linea.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t border-gray-100 px-4 py-3 text-right text-sm">
                  <p>Subtotal: <span className="font-medium">{formatMXN(preview.subtotal)}</span></p>
                  <p className="mt-1">IVA (16%): <span className="font-medium">{formatMXN(preview.iva)}</span></p>
                  <p className="mt-1 text-base font-semibold text-gray-900">
                    Total: {formatMXN(preview.total)}
                  </p>
                </div>
              </section>

              {preview.desglosePorCategoria?.length > 0 && (
                <section className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <h2 className="font-semibold text-gray-900">Desglose por categoría</h2>
                  </div>
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-2">Categoría</th>
                        <th className="px-4 py-2 text-right">Líneas</th>
                        <th className="px-4 py-2 text-right">Unidades</th>
                        <th className="px-4 py-2 text-right">Subtotal</th>
                        <th className="px-4 py-2 text-right">IVA</th>
                        <th className="px-4 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.desglosePorCategoria.map((row) => (
                        <tr key={row.categoria} className="border-t border-gray-100">
                          <td className="px-4 py-2">{row.nombre}</td>
                          <td className="px-4 py-2 text-right">{row.lineas}</td>
                          <td className="px-4 py-2 text-right">{row.unidades}</td>
                          <td className="px-4 py-2 text-right">{formatMXN(row.subtotal)}</td>
                          <td className="px-4 py-2 text-right">{formatMXN(row.iva)}</td>
                          <td className="px-4 py-2 text-right font-medium">{formatMXN(row.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {preview.desglosePorClase?.length > 0 && (
                <section className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <h2 className="font-semibold text-gray-900">Desglose por clase</h2>
                  </div>
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-2">Clase</th>
                        <th className="px-4 py-2 text-right">Líneas</th>
                        <th className="px-4 py-2 text-right">Unidades</th>
                        <th className="px-4 py-2 text-right">Subtotal</th>
                        <th className="px-4 py-2 text-right">IVA</th>
                        <th className="px-4 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.desglosePorClase.map((row) => (
                        <tr key={row.clase} className="border-t border-gray-100">
                          <td className="px-4 py-2">{row.clase}</td>
                          <td className="px-4 py-2 text-right">{row.lineas}</td>
                          <td className="px-4 py-2 text-right">{row.unidades}</td>
                          <td className="px-4 py-2 text-right">{formatMXN(row.subtotal)}</td>
                          <td className="px-4 py-2 text-right">{formatMXN(row.iva)}</td>
                          <td className="px-4 py-2 text-right font-medium">{formatMXN(row.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
            </>
          )}

          <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-gray-900">Datos del formato de orden</h2>
            <p className="mt-1 text-sm text-gray-500">
              Misma información que el PDF de órdenes: contacto, fiscales y envío (datos de
              Labotec).
            </p>

            <form onSubmit={handleGenerar} className="mt-4 space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="folio" className="mb-1 block text-sm font-medium text-gray-700">
                    Folio (opcional)
                  </label>
                  <input
                    id="folio"
                    name="folio"
                    type="text"
                    value={form.folio}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-labotec-teal focus:ring-2 focus:ring-labotec-teal/30"
                  />
                </div>
                <div>
                  <label htmlFor="nombre" className="mb-1 block text-sm font-medium text-gray-700">
                    Nombre de contacto
                  </label>
                  <input
                    id="nombre"
                    name="nombre"
                    type="text"
                    value={form.nombre}
                    onChange={handleChange}
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-labotec-teal/30 ${
                      fieldErrors.nombre
                        ? 'border-red-400'
                        : 'border-gray-300 focus:border-labotec-teal'
                    }`}
                  />
                  {fieldErrors.nombre && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.nombre}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                    Correo
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-labotec-teal/30 ${
                      fieldErrors.email
                        ? 'border-red-400'
                        : 'border-gray-300 focus:border-labotec-teal'
                    }`}
                  />
                  {fieldErrors.email && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="mb-3 text-sm font-medium text-gray-800">Datos fiscales</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {fieldsFiscal.slice(0, 3).map(({ name, label, type, placeholder }) => (
                    <div key={name} className={name === 'direccion_fiscal' ? 'sm:col-span-2' : ''}>
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
                        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-labotec-teal/30 ${
                          fieldErrors[name]
                            ? 'border-red-400'
                            : 'border-gray-300 focus:border-labotec-teal'
                        }`}
                      />
                      {fieldErrors[name] && (
                        <p className="mt-1 text-xs text-red-600">{fieldErrors[name]}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <DireccionEnvioFields
                form={form}
                fieldErrors={fieldErrors}
                onEnvioIgualChange={handleEnvioIgualChange}
                onDireccionEnvioChange={handleChange}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                {fieldsFiscal.slice(3).map(({ name, label, type }) => (
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
                      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-labotec-teal/30 ${
                        fieldErrors[name]
                          ? 'border-red-400'
                          : 'border-gray-300 focus:border-labotec-teal'
                      }`}
                    />
                    {fieldErrors[name] && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors[name]}</p>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={generando || !preview?.totalOrdenes}
                className="rounded-lg bg-labotec-teal px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-labotec-teal-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generando ? 'Generando…' : 'Generar orden general'}
              </button>
              {!preview?.totalOrdenes && (
                <p className="text-sm text-gray-500">
                  No hay órdenes pagadas pendientes de incluir.
                </p>
              )}
            </form>
          </section>

          <section className="mt-8">
            <h2 className="font-semibold text-gray-900">Historial</h2>
            {historial.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">Aún no se ha generado ninguna orden general.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2">Fecha</th>
                      <th className="px-4 py-2">Folio</th>
                      <th className="px-4 py-2">Última compra</th>
                      <th className="px-4 py-2 text-right">Órdenes</th>
                      <th className="px-4 py-2 text-right">Unidades</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((og) => (
                      <tr key={og.id} className="border-t border-gray-100">
                        <td className="px-4 py-2">{formatFecha(og.creado_en)}</td>
                        <td className="px-4 py-2">{og.folio || '—'}</td>
                        <td className="px-4 py-2">{formatFecha(og.ultima_compra_confirmada_en)}</td>
                        <td className="px-4 py-2 text-right">{og.total_ordenes}</td>
                        <td className="px-4 py-2 text-right">{og.total_unidades}</td>
                        <td className="px-4 py-2 text-right font-medium">
                          {og.total != null ? formatMXN(og.total) : '—'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleVerPdf(og.id)}
                            className="text-sm font-medium text-labotec-teal hover:underline"
                          >
                            Ver PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

import { useRef, useState } from 'react'
import { getSafeErrorMessage } from '../lib/errors'
import { subirComprobante } from '../lib/comprobantes'

export default function ComprobanteUpload({ ordenId, onSuccess, disabled }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError('Seleccione un archivo')
      return
    }

    setUploading(true)

    try {
      await subirComprobante(ordenId, file)
      if (fileRef.current) fileRef.current.value = ''
      onSuccess?.()
    } catch (err) {
      setError(getSafeErrorMessage(err, 'No se pudo subir el comprobante'))
    } finally {
      setUploading(false)
    }
  }

  if (disabled) return null

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-lg border border-dashed border-gray-300 p-3">
      <p className="text-xs font-medium text-gray-600">Subir comprobante de pago</p>
      <p className="mt-0.5 text-xs text-gray-400">PDF, JPG o PNG — máx. 10 MB</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs"
        />
        <button
          type="submit"
          disabled={uploading}
          className="rounded bg-labotec-teal px-3 py-1 text-xs font-medium text-white hover:bg-labotec-teal-dark disabled:opacity-60"
        >
          {uploading ? 'Subiendo…' : 'Subir'}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  )
}
